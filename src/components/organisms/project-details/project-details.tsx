import React, { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";

interface ProjectDetailsProps {
  title?: string;
  description?: string;
  images: string[];
  initialImage?: string;
  videoThumb?: string;
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({
  title,
  description,
  images,
  initialImage,
  videoThumb,
}) => {
  const [selectedImage, setSelectedImage] = useState<string>(initialImage ?? images[0]);

  return (
    <div className="w-full flex flex-col">
      {/* Title */}
      {title && (
        <div className="w-full py-6 px-4 sm:py-10 sm:px-8">
          <div className="text-2xl sm:text-3xl font-extrabold text-white mb-2 border-b-4 border-blue-500 inline-block pb-2">{title}</div>
        </div>
      )}
      {/* Content Row */}
      <div className="flex flex-col lg:flex-row w-full px-2 sm:px-8 gap-8 items-stretch">
        {/* Left: Image */}
        <div className="w-full lg:w-[70%] flex items-center justify-center rounded-lg overflow-hidden bg-gray-900 h-[260px] sm:h-[340px] md:h-[480px] lg:h-[600px]">
          {selectedImage?.endsWith(".mp4") ? (
            <video
              src={selectedImage}
              controls
              autoPlay
              className="object-contain w-full h-full transition-all duration-200"
            />
          ) : (
            <img
              src={selectedImage}
              alt="content"
              className="object-contain w-full h-full transition-all duration-200"
            />
          )}
        </div>
        {/* Right: Description */}
        <div className="w-full lg:w-[30%] flex flex-col justify-start pt-2">
          {description && (
            <div className="text-lg text-gray-100">{description}</div>
          )}
        </div>
      </div>
      {/* Swiper Carousel (thumbnails) */}
      <div className="w-full px-2 mt-8 mb-8">
        <div className="w-full lg:w-[70%]">
          <Swiper
            spaceBetween={-125}
            slidesPerView={3}
            breakpoints={{
              640: { slidesPerView: 4, spaceBetween: -200 },
              1024: { slidesPerView: 4, spaceBetween: -300 },
            }}
            className="rounded-xl !pl-4 !pr-4 sm:!pl-12 sm:!pr-12"
          >
            {images.map((thumb, i) => (
              <SwiperSlide key={i}>
                {thumb.endsWith(".mp4") ? (
                  <img
                    src={videoThumb}
                    alt="Video thumbnail"
                    className={`cursor-pointer w-16 h-16 sm:w-20 sm:h-20 md:w-28 md:h-28 object-cover rounded-lg border-4 transition-all duration-200
        ${selectedImage === thumb ? "border-blue-500" : "border-transparent"}
        ${i !== images.length - 1 ? "-mr-2" : ""}
        `}
                    onClick={() => setSelectedImage(thumb)}
                  />
                ) : (
                  <img
                    src={thumb}
                    alt={`Thumbnail ${i + 1}`}
                    className={`cursor-pointer w-16 h-16 sm:w-20 sm:h-20 md:w-28 md:h-28 object-cover rounded-lg border-4 transition-all duration-200
        ${selectedImage === thumb ? "border-blue-500" : "border-transparent"}
        ${i !== images.length - 1 ? "-mr-2" : ""}
        `}
                    onClick={() => setSelectedImage(thumb)}
                  />
                )}
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetails;
