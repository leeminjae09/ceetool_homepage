import { useEffect, useState, type FormEvent } from "react";
import {
  defaultHomepageContent,
  homepageApi,
  homepageIcons,
  type HomepageCategory,
  type HomepageContent,
  type HomepageSlide,
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
const errorMessage = (error: unknown) => {
  console.error(
    "Homepage administration failed",
    error instanceof Error ? error.name : "unknown",
  );
  return error instanceof PaymentApiError
    ? error.message
    : "요청을 처리하지 못했습니다. 연결 상태와 파일을 확인한 뒤 다시 시도해 주세요.";
};
function emptySlide(): HomepageSlide {
  return { label: "", project: { name: "", description: "" } };
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
  const [revision, setRevision] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [selectedId, setSelectedId] = useState("");
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
        const content =
          saved.content ?? structuredClone(defaultHomepageContent);
        setDraft(content);
        setRevision(saved.revision);
        setSelectedId(content.categories[0]?.id ?? "");
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
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function changed() {
    setDirty(true);
    onDirtyChange(true);
    setNotice("");
  }
  function updateCategory(
    id: string,
    update: (category: HomepageCategory) => HomepageCategory,
  ) {
    setDraft((current) =>
      current
        ? {
            categories: current.categories.map((category) =>
              category.id === id ? update(category) : category,
            ),
          }
        : current,
    );
    changed();
  }
  function updateSlide(
    id: string,
    index: number,
    update: (slide: HomepageSlide) => HomepageSlide,
  ) {
    updateCategory(id, (category) => ({
      ...category,
      slides: [
        index === 0 ? update(category.slides[0]) : category.slides[0],
        index === 1 ? update(category.slides[1]) : category.slides[1],
      ],
    }));
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await homepageApi.save(draft, revision, csrf);
      if (!saved.content) throw new Error("Missing saved homepage content");
      setDraft(saved.content);
      setRevision(saved.revision);
      setDirty(false);
      onDirtyChange(false);
      setNotice("저장했습니다. 운영 홈페이지에 바로 반영됩니다.");
    } catch (err) {
      setError(errorMessage(err));
      if (err instanceof PaymentApiError && err.status === 401)
        onUnauthorized();
    } finally {
      setBusy(false);
    }
  }
  async function upload(
    id: string,
    index: number,
    file: File,
    poster: boolean,
  ) {
    if (busy) return;
    if (
      file.size === 0 ||
      file.size > 100 * 1024 * 1024 ||
      (poster && !file.type.startsWith("image/"))
    ) {
      setError(
        poster
          ? "썸네일은 100MB 이하의 이미지 파일을 선택해 주세요."
          : "파일은 0바이트보다 크고 100MB 이하여야 합니다.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setNotice("파일을 S3에 업로드하는 중입니다.");
    try {
      const media = await homepageApi.upload(file, csrf);
      updateSlide(id, index, (slide) =>
        poster && slide.media?.type === "video"
          ? { ...slide, media: { ...slide.media, poster: media.src } }
          : {
              ...slide,
              media: {
                ...media,
                alt: slide.label || slide.project.name || "프로젝트 미디어",
              },
            },
      );
      setNotice("업로드했습니다. ‘홈페이지 저장’을 눌러 공개해 주세요.");
    } catch (err) {
      setNotice("");
      setError(errorMessage(err));
      if (err instanceof PaymentApiError && err.status === 401)
        onUnauthorized();
    } finally {
      setBusy(false);
    }
  }
  function addCategory() {
    const category: HomepageCategory = {
      id: crypto.randomUUID(),
      title: "",
      tagline: "",
      icon: "shopping",
      visible: true,
      featured: false,
      features: [""],
      slides: [emptySlide(), emptySlide()],
    };
    setDraft((current) =>
      current ? { categories: [...current.categories, category] } : current,
    );
    setSelectedId(category.id);
    changed();
  }
  const selected = draft?.categories.find(
    (category) => category.id === selectedId,
  );
  const selectedIndex =
    draft?.categories.findIndex((category) => category.id === selectedId) ?? -1;
  function move(direction: number) {
    if (!draft) return;
    const categories = [...draft.categories];
    const target = selectedIndex + direction;
    [categories[selectedIndex], categories[target]] = [
      categories[target],
      categories[selectedIndex],
    ];
    setDraft({ categories });
    changed();
  }
  return (
    <section aria-labelledby="homepage-admin-title">
      <h2 id="homepage-admin-title" className="mb-3 text-xl font-semibold">
        홈페이지 관리
      </h2>
      <p className="mb-4 text-sm leading-relaxed text-gray-400">
        카테고리와 각 2개 슬라이드를 관리합니다. 파일은 기존 비공개
        S3·CloudFront를 사용하며, 저장 후 배포 없이 반영됩니다. 파일을
        교체하거나 카테고리를 삭제해도 S3 원본은 삭제하지 않습니다.
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
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-0 flex-1 text-sm">
                편집할 카테고리
                <select
                  className={input}
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                  aria-label="편집할 카테고리"
                >
                  {draft.categories.length === 0 && (
                    <option value="">카테고리 없음</option>
                  )}
                  {draft.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.title || "새 카테고리"}
                      {category.visible ? "" : " (숨김)"}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={button}
                disabled={draft.categories.length >= 24}
                onClick={addCategory}
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
                    disabled={selectedIndex <= 0}
                    onClick={() => move(-1)}
                  >
                    앞으로 이동
                  </button>
                  <button
                    type="button"
                    className={button}
                    disabled={selectedIndex >= draft.categories.length - 1}
                    onClick={() => move(1)}
                  >
                    뒤로 이동
                  </button>
                  <button
                    type="button"
                    className={`${button} text-red-300`}
                    onClick={() => {
                      if (
                        !window.confirm(
                          "이 카테고리를 홈페이지에서 삭제할까요? 저장 후 반영됩니다.",
                        )
                      )
                        return;
                      const categories = draft.categories.filter(
                        (category) => category.id !== selected.id,
                      );
                      setDraft({ categories });
                      setSelectedId(categories[0]?.id ?? "");
                      changed();
                    }}
                  >
                    카테고리 삭제
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm">
                    카테고리명
                    <input
                      className={input}
                      required
                      maxLength={40}
                      value={selected.title}
                      onChange={(event) =>
                        updateCategory(selected.id, (category) => ({
                          ...category,
                          title: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm">
                    아이콘
                    <select
                      className={input}
                      value={selected.icon}
                      onChange={(event) => {
                        const icon = homepageIcons.find(
                          (value) => value === event.target.value,
                        );
                        if (icon)
                          updateCategory(selected.id, (category) => ({
                            ...category,
                            icon,
                          }));
                      }}
                    >
                      {homepageIcons.map((icon) => (
                        <option key={icon} value={icon}>
                          {iconLabels[icon]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block text-sm">
                  한 줄 소개
                  <input
                    className={input}
                    required
                    maxLength={150}
                    value={selected.tagline}
                    onChange={(event) =>
                      updateCategory(selected.id, (category) => ({
                        ...category,
                        tagline: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="block text-sm">
                  기능 (한 줄에 하나, 1~6줄)
                  <textarea
                    className={input}
                    rows={3}
                    required
                    value={selected.features.join("\n")}
                    onChange={(event) =>
                      updateCategory(selected.id, (category) => ({
                        ...category,
                        features: event.target.value.split("\n"),
                      }))
                    }
                  />
                </label>
                <div className="flex flex-wrap gap-5 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.visible}
                      onChange={(event) =>
                        updateCategory(selected.id, (category) => ({
                          ...category,
                          visible: event.target.checked,
                        }))
                      }
                    />
                    홈페이지에 표시
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.featured}
                      onChange={(event) =>
                        updateCategory(selected.id, (category) => ({
                          ...category,
                          featured: event.target.checked,
                        }))
                      }
                    />
                    강조 테두리
                  </label>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  {selected.slides.map((slide, index) => (
                    <section
                      key={`${selected.id}-${index}`}
                      className="min-w-0 space-y-3 rounded-xl border border-gray-700 p-4"
                      aria-label={`슬라이드 ${index + 1} 설정`}
                    >
                      <h3 className="font-semibold">슬라이드 {index + 1}</h3>
                      <label className="block text-sm">
                        화면 이름
                        <input
                          className={input}
                          required
                          maxLength={150}
                          value={slide.label}
                          onChange={(event) =>
                            updateSlide(selected.id, index, (item) => ({
                              ...item,
                              label: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="block text-sm">
                        프로젝트명
                        <input
                          className={input}
                          required
                          maxLength={100}
                          value={slide.project.name}
                          onChange={(event) =>
                            updateSlide(selected.id, index, (item) => ({
                              ...item,
                              project: {
                                ...item.project,
                                name: event.target.value,
                                portfolioId: undefined,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="block text-sm">
                        간략한 설명
                        <input
                          className={input}
                          required
                          maxLength={250}
                          value={slide.project.description}
                          onChange={(event) =>
                            updateSlide(selected.id, index, (item) => ({
                              ...item,
                              project: {
                                ...item.project,
                                description: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="block text-sm">
                        사이트 링크 (선택)
                        <input
                          className={input}
                          type="url"
                          pattern="https://.*"
                          placeholder="https://"
                          value={slide.project.url ?? ""}
                          onChange={(event) =>
                            updateSlide(selected.id, index, (item) => ({
                              ...item,
                              project: {
                                ...item.project,
                                url: event.target.value,
                                portfolioId: undefined,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="block text-sm">
                        사진·영상 (최대 100MB)
                        <input
                          className={`${input} text-xs`}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                          aria-label={`슬라이드 ${index + 1} 사진·영상`}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (file)
                              void upload(selected.id, index, file, false);
                          }}
                        />
                      </label>
                      {slide.media && (
                        <>
                          {slide.media.type === "video" ? (
                            <video
                              key={slide.media.src}
                              src={slide.media.src}
                              poster={slide.media.poster}
                              controls
                              playsInline
                              preload="none"
                              className="aspect-video w-full rounded-lg bg-gray-950 object-contain"
                              onError={() =>
                                setError(
                                  "영상 미리보기를 불러오지 못했습니다. 파일을 확인해 주세요.",
                                )
                              }
                            />
                          ) : (
                            <img
                              src={slide.media.src}
                              alt={slide.media.alt}
                              className="aspect-video w-full rounded-lg bg-gray-950 object-contain"
                              onError={() =>
                                setError(
                                  "이미지 미리보기를 불러오지 못했습니다. 파일을 확인해 주세요.",
                                )
                              }
                            />
                          )}
                          <label className="block text-sm">
                            미디어 대체 설명
                            <input
                              className={input}
                              required
                              maxLength={300}
                              value={slide.media.alt}
                              onChange={(event) =>
                                updateSlide(selected.id, index, (item) => ({
                                  ...item,
                                  media: item.media
                                    ? { ...item.media, alt: event.target.value }
                                    : undefined,
                                }))
                              }
                            />
                          </label>
                          {slide.media.type === "video" && (
                            <label className="block text-sm">
                              영상 썸네일 (선택)
                              <input
                                className={`${input} text-xs`}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                aria-label={`슬라이드 ${index + 1} 영상 썸네일`}
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  event.target.value = "";
                                  if (file)
                                    void upload(selected.id, index, file, true);
                                }}
                              />
                            </label>
                          )}
                          <button
                            type="button"
                            className={`${button} text-red-300`}
                            onClick={() =>
                              updateSlide(selected.id, index, (item) => ({
                                ...item,
                                media: undefined,
                              }))
                            }
                          >
                            미디어 연결 해제
                          </button>
                        </>
                      )}
                    </section>
                  ))}
                </div>
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
