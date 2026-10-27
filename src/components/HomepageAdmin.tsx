import { useEffect, useState, type FormEvent } from "react";
import {
  homepageApi,
  homepageIcons,
  type HomepageCategory,
  type HomepageContent,
  type HomepageProject,
} from "app/homepage-api";
import { PaymentApiError } from "app/payments-api";

const input =
  "mt-1 block w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400";
const button =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-600 px-4 py-2 text-sm hover:bg-gray-800 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400";
const iconLabels = {
  shopping: "쇼핑몰",
  payment: "결제",
  ai: "AI·챗봇",
  marketing: "마케팅",
  automation: "자동화",
  finance: "금융·공공",
};
function TextField({
  label,
  value,
  onChange,
  max = 150,
  multiline = false,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  multiline?: boolean;
  optional?: boolean;
}) {
  return (
    <label className="block text-sm">
      {label}
      {multiline ? (
        <textarea
          className={input}
          value={value}
          required={!optional}
          maxLength={max}
          rows={4}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className={input}
          value={value}
          required={!optional}
          maxLength={max}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}
function errorMessage(error: unknown) {
  console.error(
    "Homepage administration failed",
    error instanceof Error ? error.name : "unknown",
  );
  return error instanceof PaymentApiError
    ? error.message
    : "요청을 처리하지 못했습니다. 연결 상태와 파일을 확인한 뒤 다시 시도해 주세요.";
}
function reordered<T>(items: T[], index: number, direction: number): T[] {
  const result = [...items];
  [result[index], result[index + direction]] = [
    result[index + direction],
    result[index],
  ];
  return result;
}

export default function HomepageAdmin({
  csrf,
  onUnauthorized,
  onDirtyChange,
}: {
  csrf: string;
  onUnauthorized: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<HomepageContent | null>(null);
  const [revision, setRevision] = useState("");
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<"categories" | "projects" | "documents">(
    "categories",
  );
  const [selectedId, setSelectedId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    setDraft(null);
    void homepageApi
      .load(true)
      .then((saved) => {
        if (!active) return;
        setDraft(saved.content);
        setRevision(saved.revision);
        setSelectedId(saved.content.categories[0]?.id ?? "");
        setProjectId(saved.content.projects[0]?.id ?? "");
        setDocumentId(saved.content.documents[0]?.id ?? "");
        setDirty(false);
        onDirtyChange(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(errorMessage(err));
        if (err instanceof PaymentApiError && err.status === 401)
          onUnauthorized();
      });
    return () => {
      active = false;
    };
  }, [csrf, reload, onUnauthorized, onDirtyChange]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  function change(update: (content: HomepageContent) => HomepageContent) {
    setDraft((current) => (current ? update(current) : current));
    setDirty(true);
    onDirtyChange(true);
    setNotice("");
  }
  function category(update: (category: HomepageCategory) => HomepageCategory) {
    change((content) => ({
      ...content,
      categories: content.categories.map((item) =>
        item.id === selectedId ? update(item) : item,
      ),
    }));
  }
  function project(
    id: string,
    update: (project: HomepageProject) => HomepageProject,
  ) {
    change((content) => ({
      ...content,
      projects: content.projects.map((item) =>
        item.id === id ? update(item) : item,
      ),
    }));
  }
  function failure(err: unknown) {
    setError(errorMessage(err));
    if (err instanceof PaymentApiError && err.status === 401) onUnauthorized();
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await homepageApi.save(draft, revision, csrf);
      setDraft(saved.content);
      setRevision(saved.revision);
      setDirty(false);
      onDirtyChange(false);
      setNotice("저장했습니다. 운영 홈페이지와 프로젝트 상세에 반영됩니다.");
    } catch (err) {
      failure(err);
    } finally {
      setBusy(false);
    }
  }
  async function upload(id: string, file: File, posterId?: string) {
    if (busy) return;
    if (
      file.size === 0 ||
      file.size > 100 * 1024 * 1024 ||
      (posterId && !file.type.startsWith("image/"))
    ) {
      setError(
        "0바이트보다 크고 100MB 이하인 파일을 선택해 주세요. 썸네일은 이미지만 가능합니다.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setNotice("파일을 S3에 업로드하는 중입니다.");
    try {
      const media = await homepageApi.upload(file, csrf);
      project(id, (item) => ({
        ...item,
        media: posterId
          ? item.media.map((original) =>
              original.id === posterId
                ? { ...original, poster: media.src }
                : original,
            )
          : [
              ...item.media,
              {
                ...media,
                id: crypto.randomUUID(),
                alt: item.name || "프로젝트 미디어",
              },
            ],
      }));
      setNotice("업로드했습니다. 홈페이지 저장을 눌러 공개해 주세요.");
    } catch (err) {
      setNotice("");
      failure(err);
    } finally {
      setBusy(false);
    }
  }
  const selected = draft?.categories.find((item) => item.id === selectedId);
  const selectedProject = draft?.projects.find((item) => item.id === projectId);
  const selectedDocument = draft?.documents.find(
    (item) => item.id === documentId,
  );
  const categoryIndex =
    draft?.categories.findIndex((item) => item.id === selectedId) ?? -1;
  const projectIndex =
    draft?.projects.findIndex((item) => item.id === projectId) ?? -1;
  return (
    <section aria-labelledby="homepage-admin-title">
      <h2 id="homepage-admin-title" className="mb-3 text-xl font-semibold">
        홈페이지 관리
      </h2>
      <p className="mb-4 text-sm leading-relaxed text-gray-400">
        카테고리·프로젝트·기존 상세 페이지를 DB에서 관리합니다. 파일은 S3에
        업로드되며 저장 후 공개됩니다. 연결을 해제해도 S3 원본은 삭제하지
        않습니다.
      </p>
      {error && (
        <p
          role="alert"
          className="my-4 rounded-lg border border-red-400/40 p-3 text-sm text-red-200"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="my-4 text-sm text-green-300">
          {notice}
        </p>
      )}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={button}
          disabled={busy}
          onClick={() => {
            if (
              !dirty ||
              window.confirm("저장하지 않은 변경을 버리고 다시 불러올까요?")
            )
              setReload((value) => value + 1);
          }}
        >
          새로 불러오기
        </button>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className={`${button} text-blue-300`}
        >
          공개 홈페이지 보기 ↗
        </a>
        {dirty && (
          <span className="text-sm text-yellow-300">
            저장하지 않은 변경 사항이 있습니다.
          </span>
        )}
      </div>
      {!draft ? (
        <p role="status">
          {error ? "설정을 불러오지 못했습니다." : "설정을 불러오는 중입니다."}
        </p>
      ) : (
        <form onSubmit={(event) => void save(event)}>
          <fieldset
            disabled={busy}
            className="min-w-0 space-y-5 disabled:opacity-70"
          >
            <div
              role="group"
              aria-label="콘텐츠 편집 메뉴"
              className="flex flex-wrap gap-2"
            >
              {(["categories", "projects", "documents"] as const).map(
                (value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={view === value}
                    onClick={() => setView(value)}
                    className={`${button} ${view === value ? "border-purple-400 text-purple-300" : ""}`}
                  >
                    {value === "categories"
                      ? "카테고리"
                      : value === "projects"
                        ? "프로젝트·미디어"
                        : "기존 상세 페이지"}
                  </button>
                ),
              )}
            </div>
            {view === "categories" && (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="min-w-0 flex-1 text-sm">
                    편집할 카테고리
                    <select
                      className={input}
                      value={selectedId}
                      onChange={(event) => setSelectedId(event.target.value)}
                    >
                      {!draft.categories.length && (
                        <option value="">카테고리 없음</option>
                      )}
                      {draft.categories.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title || "새 카테고리"}
                          {item.visible ? "" : " (숨김)"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className={button}
                    disabled={
                      draft.categories.length >= 24 || !draft.projects.length
                    }
                    onClick={() => {
                      const id = crypto.randomUUID();
                      const slide = {
                        label: "프로젝트 화면",
                        projectId: draft.projects[0].id,
                      };
                      change((content) => ({
                        ...content,
                        categories: [
                          ...content.categories,
                          {
                            id,
                            title: "",
                            tagline: "",
                            description: "",
                            icon: "shopping",
                            visible: true,
                            featured: false,
                            features: [""],
                            slides: [{ ...slide }, { ...slide }],
                          },
                        ],
                      }));
                      setSelectedId(id);
                    }}
                  >
                    카테고리 추가
                  </button>
                </div>
                {selected && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={button}
                        disabled={categoryIndex <= 0}
                        onClick={() =>
                          change((content) => ({
                            ...content,
                            categories: reordered(
                              content.categories,
                              categoryIndex,
                              -1,
                            ),
                          }))
                        }
                      >
                        앞으로 이동
                      </button>
                      <button
                        type="button"
                        className={button}
                        disabled={categoryIndex >= draft.categories.length - 1}
                        onClick={() =>
                          change((content) => ({
                            ...content,
                            categories: reordered(
                              content.categories,
                              categoryIndex,
                              1,
                            ),
                          }))
                        }
                      >
                        뒤로 이동
                      </button>
                      <button
                        type="button"
                        className={`${button} text-red-300`}
                        onClick={() => {
                          if (
                            !window.confirm(
                              "카테고리를 삭제할까요? 프로젝트 원본은 유지됩니다.",
                            )
                          )
                            return;
                          const categories = draft.categories.filter(
                            (item) => item.id !== selectedId,
                          );
                          change((content) => ({ ...content, categories }));
                          setSelectedId(categories[0]?.id ?? "");
                        }}
                      >
                        카테고리 삭제
                      </button>
                    </div>
                    <TextField
                      label="카테고리명"
                      value={selected.title}
                      max={40}
                      onChange={(title) =>
                        category((item) => ({ ...item, title }))
                      }
                    />
                    <TextField
                      label="한 줄 소개"
                      value={selected.tagline}
                      onChange={(tagline) =>
                        category((item) => ({ ...item, tagline }))
                      }
                    />
                    <TextField
                      label="분야 설명"
                      value={selected.description}
                      max={4000}
                      multiline
                      onChange={(description) =>
                        category((item) => ({ ...item, description }))
                      }
                    />
                    <label className="block text-sm">
                      아이콘
                      <select
                        className={input}
                        value={selected.icon}
                        onChange={(event) => {
                          const icon = homepageIcons.find(
                            (value) => value === event.target.value,
                          );
                          if (icon) category((item) => ({ ...item, icon }));
                        }}
                      >
                        {homepageIcons.map((icon) => (
                          <option key={icon} value={icon}>
                            {iconLabels[icon]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <TextField
                      label="기능 (한 줄에 하나, 1~6줄)"
                      value={selected.features.join("\n")}
                      max={1000}
                      multiline
                      onChange={(features) =>
                        category((item) => ({
                          ...item,
                          features: features.split("\n"),
                        }))
                      }
                    />
                    <div className="flex flex-wrap gap-5 text-sm">
                      <label>
                        <input
                          type="checkbox"
                          checked={selected.visible}
                          onChange={(event) =>
                            category((item) => ({
                              ...item,
                              visible: event.target.checked,
                            }))
                          }
                        />{" "}
                        홈페이지에 표시
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={selected.featured}
                          onChange={(event) =>
                            category((item) => ({
                              ...item,
                              featured: event.target.checked,
                            }))
                          }
                        />{" "}
                        강조 테두리
                      </label>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {selected.slides.map((slide, index) => {
                        const linkedProject = draft.projects.find(
                          (item) => item.id === slide.projectId,
                        );
                        function update(update: Partial<typeof slide>) {
                          category((item) => ({
                            ...item,
                            slides: [
                              index === 0
                                ? { ...item.slides[0], ...update }
                                : item.slides[0],
                              index === 1
                                ? { ...item.slides[1], ...update }
                                : item.slides[1],
                            ],
                          }));
                        }
                        return (
                          <section
                            key={index}
                            aria-label={`슬라이드 ${index + 1} 설정`}
                            className="min-w-0 space-y-3 rounded-xl border border-gray-700 p-4"
                          >
                            <h3 className="font-semibold">
                              슬라이드 {index + 1}
                            </h3>
                            <TextField
                              label="화면 이름"
                              value={slide.label}
                              onChange={(label) => update({ label })}
                            />
                            <label className="block text-sm">
                              연결할 프로젝트
                              <select
                                className={input}
                                value={slide.projectId}
                                onChange={(event) =>
                                  update({
                                    projectId: event.target.value,
                                    mediaId: undefined,
                                  })
                                }
                              >
                                {draft.projects.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name || "새 프로젝트"}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block text-sm">
                              표시할 미디어
                              <select
                                className={input}
                                value={slide.mediaId ?? ""}
                                onChange={(event) =>
                                  update({
                                    mediaId: event.target.value || undefined,
                                  })
                                }
                              >
                                <option value="">이미지 준비 중</option>
                                {linkedProject?.media.map((media) => (
                                  <option key={media.id} value={media.id}>
                                    {media.type === "video" ? "영상" : "사진"} ·{" "}
                                    {media.alt}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <p className="text-sm text-gray-400">
                              {linkedProject?.name} ·{" "}
                              {linkedProject?.description}
                            </p>
                          </section>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
            {view === "projects" && (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="min-w-0 flex-1 text-sm">
                    편집할 프로젝트
                    <select
                      className={input}
                      value={projectId}
                      onChange={(event) => setProjectId(event.target.value)}
                    >
                      {!draft.projects.length && (
                        <option value="">프로젝트 없음</option>
                      )}
                      {draft.projects.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name || "새 프로젝트"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className={button}
                    disabled={draft.projects.length >= 200}
                    onClick={() => {
                      const id = crypto.randomUUID();
                      change((content) => ({
                        ...content,
                        projects: [
                          ...content.projects,
                          {
                            id,
                            name: "",
                            description: "",
                            details: "",
                            archive: false,
                            media: [],
                          },
                        ],
                      }));
                      setProjectId(id);
                    }}
                  >
                    프로젝트 추가
                  </button>
                </div>
                {selectedProject && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={button}
                        disabled={projectIndex <= 0}
                        onClick={() =>
                          change((content) => ({
                            ...content,
                            projects: reordered(
                              content.projects,
                              projectIndex,
                              -1,
                            ),
                          }))
                        }
                      >
                        프로젝트 앞으로
                      </button>
                      <button
                        type="button"
                        className={button}
                        disabled={projectIndex >= draft.projects.length - 1}
                        onClick={() =>
                          change((content) => ({
                            ...content,
                            projects: reordered(
                              content.projects,
                              projectIndex,
                              1,
                            ),
                          }))
                        }
                      >
                        프로젝트 뒤로
                      </button>
                      <button
                        type="button"
                        className={`${button} text-red-300`}
                        onClick={() => {
                          if (
                            draft.categories.some((item) =>
                              item.slides.some(
                                (slide) => slide.projectId === projectId,
                              ),
                            ) ||
                            draft.documents.some((item) =>
                              item.projectIds.includes(projectId),
                            )
                          ) {
                            setError(
                              "카테고리 또는 상세 페이지에서 연결을 해제한 뒤 프로젝트를 삭제해 주세요.",
                            );
                            return;
                          }
                          if (
                            !window.confirm(
                              "프로젝트와 미디어 연결을 삭제할까요? S3 원본은 유지됩니다.",
                            )
                          )
                            return;
                          const projects = draft.projects.filter(
                            (item) => item.id !== projectId,
                          );
                          change((content) => ({ ...content, projects }));
                          setProjectId(projects[0]?.id ?? "");
                        }}
                      >
                        프로젝트 삭제
                      </button>
                    </div>
                    <TextField
                      label="프로젝트명"
                      value={selectedProject.name}
                      max={100}
                      onChange={(name) =>
                        project(projectId, (item) => ({ ...item, name }))
                      }
                    />
                    <TextField
                      label="간략한 설명"
                      value={selectedProject.description}
                      max={250}
                      onChange={(description) =>
                        project(projectId, (item) => ({ ...item, description }))
                      }
                    />
                    <TextField
                      label="상세 설명"
                      value={selectedProject.details}
                      max={4000}
                      multiline
                      onChange={(details) =>
                        project(projectId, (item) => ({ ...item, details }))
                      }
                    />
                    <TextField
                      label="사이트 링크 (HTTPS, 선택)"
                      value={selectedProject.url ?? ""}
                      max={2048}
                      optional
                      onChange={(url) =>
                        project(projectId, (item) => ({
                          ...item,
                          url: url || undefined,
                        }))
                      }
                    />
                    <label className="block text-sm">
                      <input
                        type="checkbox"
                        checked={selectedProject.archive}
                        onChange={(event) =>
                          project(projectId, (item) => ({
                            ...item,
                            archive: event.target.checked,
                          }))
                        }
                      />{" "}
                      하단 추가 수행 이력에 표시
                    </label>
                    <label className="block text-sm">
                      사진·영상 추가 (최대 100MB)
                      <input
                        type="file"
                        className={input}
                        disabled={selectedProject.media.length >= 30}
                        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) void upload(projectId, file);
                        }}
                      />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {selectedProject.media.map((media, index) => {
                        const update = (patch: Partial<typeof media>) =>
                          project(projectId, (item) => ({
                            ...item,
                            media: item.media.map((original) =>
                              original.id === media.id
                                ? { ...original, ...patch }
                                : original,
                            ),
                          }));
                        return (
                          <section
                            key={media.id}
                            aria-label={`미디어 ${index + 1} 설정`}
                            className="min-w-0 space-y-3 rounded-xl border border-gray-700 p-4"
                          >
                            {media.type === "video" ? (
                              <video
                                key={media.src}
                                src={media.src}
                                poster={media.poster}
                                controls
                                playsInline
                                preload="none"
                                className="aspect-video w-full bg-gray-950 object-contain"
                                onError={() =>
                                  setError(
                                    "영상 미리보기를 불러오지 못했습니다. 주소를 확인해 주세요.",
                                  )
                                }
                              />
                            ) : (
                              <img
                                src={media.src}
                                alt={media.alt}
                                className="aspect-video w-full bg-gray-950 object-contain"
                                onError={() =>
                                  setError(
                                    "이미지 미리보기를 불러오지 못했습니다. 주소를 확인해 주세요.",
                                  )
                                }
                              />
                            )}
                            <TextField
                              label="미디어 주소 (CloudFront)"
                              value={media.src}
                              max={2048}
                              onChange={(src) => update({ src })}
                            />
                            <TextField
                              label="대체 설명"
                              value={media.alt}
                              max={300}
                              onChange={(alt) => update({ alt })}
                            />
                            {media.type === "video" && (
                              <>
                                <TextField
                                  label="썸네일 주소 (선택)"
                                  value={media.poster ?? ""}
                                  max={2048}
                                  optional
                                  onChange={(poster) =>
                                    update({ poster: poster || undefined })
                                  }
                                />
                                <label className="block text-sm">
                                  영상 썸네일 업로드
                                  <input
                                    className={input}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    onChange={(event) => {
                                      const file = event.target.files?.[0];
                                      event.target.value = "";
                                      if (file)
                                        void upload(projectId, file, media.id);
                                    }}
                                  />
                                </label>
                              </>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className={button}
                                disabled={index === 0}
                                onClick={() =>
                                  project(projectId, (item) => ({
                                    ...item,
                                    media: reordered(item.media, index, -1),
                                  }))
                                }
                              >
                                미디어 앞으로
                              </button>
                              <button
                                type="button"
                                className={button}
                                disabled={
                                  index === selectedProject.media.length - 1
                                }
                                onClick={() =>
                                  project(projectId, (item) => ({
                                    ...item,
                                    media: reordered(item.media, index, 1),
                                  }))
                                }
                              >
                                미디어 뒤로
                              </button>
                              <button
                                type="button"
                                className={`${button} text-red-300`}
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      "미디어 연결을 해제할까요? 이 미디어를 사용한 슬라이드는 이미지 준비 중으로 바뀝니다.",
                                    )
                                  )
                                    return;
                                  change((content) => ({
                                    ...content,
                                    projects: content.projects.map((item) =>
                                      item.id === projectId
                                        ? {
                                            ...item,
                                            media: item.media.filter(
                                              (item) => item.id !== media.id,
                                            ),
                                          }
                                        : item,
                                    ),
                                    categories: content.categories.map(
                                      (item) => ({
                                        ...item,
                                        slides: [
                                          {
                                            ...item.slides[0],
                                            mediaId:
                                              item.slides[0].mediaId ===
                                              media.id
                                                ? undefined
                                                : item.slides[0].mediaId,
                                          },
                                          {
                                            ...item.slides[1],
                                            mediaId:
                                              item.slides[1].mediaId ===
                                              media.id
                                                ? undefined
                                                : item.slides[1].mediaId,
                                          },
                                        ],
                                      }),
                                    ),
                                  }));
                                }}
                              >
                                미디어 연결 해제
                              </button>
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
            {view === "documents" && (
              <>
                <label className="block text-sm">
                  편집할 상세 페이지
                  <select
                    className={input}
                    value={documentId}
                    onChange={(event) => setDocumentId(event.target.value)}
                  >
                    {draft.documents.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title} (/docs/{item.id})
                      </option>
                    ))}
                  </select>
                </label>
                {selectedDocument && (
                  <>
                    <a
                      href={`/docs/${selectedDocument.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-300 underline"
                    >
                      상세 페이지 열기 ↗
                    </a>
                    {(["title", "description", "details"] as const).map(
                      (field) => (
                        <TextField
                          key={field}
                          label={
                            field === "title"
                              ? "페이지 제목"
                              : field === "description"
                                ? "페이지 소개"
                                : "페이지 본문"
                          }
                          value={selectedDocument[field]}
                          max={field === "title" ? 100 : 4000}
                          multiline={field !== "title"}
                          onChange={(value) =>
                            change((content) => ({
                              ...content,
                              documents: content.documents.map((item) =>
                                item.id === documentId
                                  ? { ...item, [field]: value }
                                  : item,
                              ),
                            }))
                          }
                        />
                      ),
                    )}
                    <div className="space-y-2 text-sm">
                      <p className="text-gray-400">
                        연결할 프로젝트 (체크한 순서대로 표시)
                      </p>
                      {draft.projects.map((project) => (
                        <label
                          key={project.id}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="checkbox"
                            checked={selectedDocument.projectIds.includes(
                              project.id,
                            )}
                            onChange={(event) =>
                              change((content) => ({
                                ...content,
                                documents: content.documents.map((item) =>
                                  item.id === documentId
                                    ? {
                                        ...item,
                                        projectIds: event.target.checked
                                          ? [...item.projectIds, project.id]
                                          : item.projectIds.filter(
                                              (id) => id !== project.id,
                                            ),
                                      }
                                    : item,
                                ),
                              }))
                            }
                          />
                          {project.name}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
            <button
              type="submit"
              className={`${button} bg-blue-600 font-semibold hover:bg-blue-500`}
              disabled={!dirty}
            >
              홈페이지 저장
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
