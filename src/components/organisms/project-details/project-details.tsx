import { useState } from "react";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";

type ProjectMedia =
  | { type: "image"; src: string; alt: string }
  | { type: "video"; src: string; alt: string; poster: string };

export interface ProjectDetailsProps {
  title: string;
  description: string;
  media: readonly [ProjectMedia, ...ProjectMedia[]];
  url?: string;
}

export const ProjectDetails = ({
  title,
  description,
  media,
  url,
}: ProjectDetailsProps) => {
  const [selectedMedia, setSelectedMedia] = useState(media[0]);
  const [failedSources, setFailedSources] = useState<string[]>([]);

  const markFailed = (src: string) => {
    setFailedSources((current) =>
      current.includes(src) ? current : [...current, src],
    );
  };

  return (
    <article className="min-w-0 rounded-xl border border-gray-700 bg-gray-900 p-4 sm:p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-white">{title}</h2>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${title} 사이트 방문 (새 창)`}
            className="inline-flex items-center gap-2 rounded text-blue-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400"
          >
            사이트 방문
            <ArrowTopRightOnSquareIcon className="h-5 w-5" aria-hidden="true" />
          </a>
        )}
      </header>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gray-950">
            {failedSources.includes(selectedMedia.src) ? (
              <div
                role="alert"
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-sm text-gray-200"
              >
                <p>미디어를 불러오지 못했습니다.</p>
                <button
                  type="button"
                  onClick={() =>
                    setFailedSources((current) =>
                      current.filter((src) => src !== selectedMedia.src),
                    )
                  }
                  className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  다시 시도
                </button>
              </div>
            ) : selectedMedia.type === "video" ? (
              <video
                key={selectedMedia.src}
                src={selectedMedia.src}
                poster={selectedMedia.poster}
                controls
                playsInline
                preload="none"
                aria-label={selectedMedia.alt}
                onError={() => markFailed(selectedMedia.src)}
                className="absolute inset-0 h-full w-full object-contain"
              />
            ) : (
              <img
                key={selectedMedia.src}
                src={selectedMedia.src}
                alt={selectedMedia.alt}
                loading="lazy"
                decoding="async"
                onError={() => markFailed(selectedMedia.src)}
                className="absolute inset-0 h-full w-full object-contain"
              />
            )}
          </div>

          <div
            role="group"
            aria-label={`${title} 미디어 선택`}
            className="mt-3 flex gap-3 overflow-x-auto p-1"
          >
            {media.map((item, index) => {
              const thumbnail = item.type === "video" ? item.poster : item.src;

              return (
                <button
                  key={item.src}
                  type="button"
                  aria-label={`${title} ${item.type === "video" ? "영상" : "사진"} ${index + 1} 보기`}
                  aria-pressed={selectedMedia.src === item.src}
                  onClick={() => setSelectedMedia(item)}
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors sm:h-20 sm:w-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                    selectedMedia.src === item.src
                      ? "border-blue-400"
                      : "border-gray-700 hover:border-gray-400"
                  }`}
                >
                  {failedSources.includes(thumbnail) ? (
                    <span className="flex h-full items-center justify-center bg-gray-800 p-1 text-xs text-gray-300">
                      미리보기 없음
                    </span>
                  ) : (
                    <img
                      src={thumbnail}
                      alt=""
                      width={80}
                      height={80}
                      loading="lazy"
                      decoding="async"
                      onError={() => markFailed(thumbnail)}
                      className="h-full w-full object-cover"
                    />
                  )}
                  {item.type === "video" && (
                    <span className="absolute bottom-0 inset-x-0 bg-black/75 text-xs text-white">
                      영상
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-gray-400">
              {selectedMedia.type === "video"
                ? "재생 버튼을 누르면 영상이 시작됩니다."
                : "작은 이미지를 선택하면 크게 볼 수 있습니다."}
            </p>
            <a
              href={selectedMedia.src}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${selectedMedia.alt} 원본 열기 (새 창)`}
              className="rounded text-blue-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
            >
              원본 열기
            </a>
          </div>
          <p aria-live="polite" className="sr-only">
            선택한 미디어: {selectedMedia.alt}
          </p>
        </div>

        <p className="min-w-0 text-gray-300 leading-relaxed">{description}</p>
      </div>
    </article>
  );
};

export default ProjectDetails;
