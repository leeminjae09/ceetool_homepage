import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y } from "swiper/modules";
import type { Swiper as SwiperInstance } from "swiper";
import type { Service } from "app/services";
import { categoryService, type HomepageContent } from "app/homepage-api";
import type { PortfolioProjectId } from "app/portfolio";
import Card, { ProjectCaption } from "components/organisms/card/card";
import "swiper/css";
import "swiper/css/a11y";

interface ServiceShowcaseProps {
  dialogOpen: boolean;
  onProjectSelect: (id: PortfolioProjectId) => void;
  content: HomepageContent;
}

function MediaPreview({
  item,
  active,
  onVideoPlay,
}: {
  item: Service["showcase"][number];
  active: boolean;
  onVideoPlay: (video: HTMLVideoElement) => void;
}) {
  const [failed, setFailed] = useState(false);
  const { media } = item;

  if (!media) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-blue-400/10 via-gray-800 to-purple-400/10 sm:aspect-[16/10]">
        <div className="flex flex-col items-center gap-4 text-gray-400">
          <div className="rounded-2xl border border-purple-300/15 bg-gray-900/50 p-5">
            <PhotoIcon
              className="h-9 w-9 text-purple-300/60"
              aria-hidden="true"
            />
          </div>
          <p className="text-sm">이미지 준비 중</p>
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <div
        role="alert"
        className="flex aspect-[4/3] flex-col items-center justify-center gap-4 bg-gray-800 p-4 text-center text-sm text-gray-300 sm:aspect-[16/10]"
      >
        <p>미디어를 불러오지 못했습니다.</p>
        <button
          type="button"
          tabIndex={active ? 0 : -1}
          onClick={() => setFailed(false)}
          className="min-h-11 rounded-lg border border-gray-600 px-4 hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return media.type === "video" ? (
    <video
      src={media.src}
      poster={media.poster}
      controls={active}
      tabIndex={active ? 0 : -1}
      playsInline
      preload="none"
      aria-label={media.alt}
      onPlay={(event) => onVideoPlay(event.currentTarget)}
      onError={() => setFailed(true)}
      className="aspect-[4/3] w-full bg-gray-950 object-contain sm:aspect-[16/10]"
    />
  ) : (
    <img
      src={media.src}
      alt={media.alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="aspect-[4/3] w-full bg-gray-950 object-contain sm:aspect-[16/10]"
    />
  );
}

function ServiceRow({
  service,
  index,
  onProjectSelect,
  onVideoPlay,
}: {
  service: Service;
  index: number;
  onProjectSelect: ServiceShowcaseProps["onProjectSelect"];
  onVideoPlay: (video?: HTMLVideoElement) => void;
}) {
  const [swiper, setSwiper] = useState<SwiperInstance | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const titleId = `service-${index + 1}-title`;
  const carouselId = `service-${index + 1}-media`;
  const { Icon } = service;

  return (
    <article
      aria-labelledby={titleId}
      className={`grid min-w-0 content-start items-start gap-6 rounded-2xl border bg-gray-900/90 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] ${
        service.featured ? "border-blue-400/30" : "border-gray-700/80"
      }`}
    >
      <h3
        id={titleId}
        className="flex min-w-0 items-center gap-2 overflow-x-auto whitespace-nowrap text-lg font-bold leading-snug tracking-tight text-white sm:text-xl md:col-span-2 lg:col-span-1 xl:col-span-2"
      >
        <Icon className="h-5 w-5 shrink-0 text-purple-300" aria-hidden="true" />
        <span>{service.title}</span>
      </h3>
      <div className="min-w-0">
        <p className="text-sm leading-relaxed text-gray-400">
          {service.tagline}
        </p>
        <div className="mt-6">
          <Card title={service.title} features={service.features} />
        </div>
      </div>
      <div className="min-w-0">
        <div
          id={carouselId}
          role="group"
          aria-roledescription="캐러셀"
          aria-label={`${service.title} 대표 화면`}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              if (event.key === "ArrowLeft") swiper?.slidePrev();
              else swiper?.slideNext();
            }
          }}
          className="overflow-hidden rounded-xl border border-gray-700 bg-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400"
        >
          <Swiper
            modules={[A11y]}
            slidesPerView={1}
            spaceBetween={16}
            onSwiper={setSwiper}
            onSlideChange={(instance) => {
              onVideoPlay();
              setActiveIndex(instance.activeIndex);
            }}
            a11y={{
              slideLabelMessage: "{{index}} / {{slidesLength}}",
              itemRoleDescriptionMessage: "슬라이드",
            }}
          >
            {service.showcase.map((item, slideIndex) => (
              <SwiperSlide key={slideIndex}>
                <figure aria-hidden={activeIndex !== slideIndex}>
                  <MediaPreview
                    key={item.media?.src ?? item.label}
                    item={item}
                    active={activeIndex === slideIndex}
                    onVideoPlay={onVideoPlay}
                  />
                </figure>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
        <div
          role="status"
          aria-atomic="true"
          className="mt-3 min-w-0 overflow-x-auto px-1 py-1"
        >
          <ProjectCaption
            project={service.showcase[activeIndex].project}
            onProjectSelect={onProjectSelect}
          />
        </div>
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            aria-label={`${service.title} 이전 화면`}
            aria-controls={carouselId}
            disabled={activeIndex === 0}
            onClick={() => swiper?.slidePrev()}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-700 text-gray-200 hover:border-purple-400 hover:text-purple-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 disabled:cursor-default disabled:opacity-30 disabled:hover:border-gray-700 disabled:hover:text-gray-200"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`${service.title} 다음 화면`}
            aria-controls={carouselId}
            disabled={activeIndex === service.showcase.length - 1}
            onClick={() => swiper?.slideNext()}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-700 text-gray-200 hover:border-purple-400 hover:text-purple-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 disabled:cursor-default disabled:opacity-30 disabled:hover:border-gray-700 disabled:hover:text-gray-200"
          >
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function ServiceShowcase({
  dialogOpen,
  onProjectSelect,
  content,
}: ServiceShowcaseProps) {
  const sectionRef = useRef<HTMLElement>(null);

  function pauseVideos(except?: HTMLVideoElement) {
    sectionRef.current?.querySelectorAll("video").forEach((video) => {
      if (video !== except) video.pause();
    });
  }

  useEffect(() => {
    if (dialogOpen) {
      sectionRef.current
        ?.querySelectorAll("video")
        .forEach((video) => video.pause());
    }
  }, [dialogOpen]);

  return (
    <section
      ref={sectionRef}
      id="services"
      aria-label="개발 서비스 및 프로젝트"
      className="service-showcase scroll-mt-6 pb-8 pt-6 sm:pt-10"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {content.categories
          .filter((category) => category.visible)
          .map((category, index) => (
            <ServiceRow
              key={category.id}
              service={categoryService(category)}
              index={index}
              onProjectSelect={onProjectSelect}
              onVideoPlay={pauseVideos}
            />
          ))}
      </div>
    </section>
  );
}
