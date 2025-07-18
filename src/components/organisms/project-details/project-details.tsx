import React, { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import { Navigation } from "swiper/modules";

interface ProjectDetailsProps {
  title?: string;
  description?: string;
  images: string[];
  initialImage?: string;
  // You can add more props as needed!
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({
  title,
  description,
  images,
  initialImage,
}) => {
  const [selectedImage, setSelectedImage] = useState<string>(initialImage ?? images[0]);

  return (
    <div className="w-full flex flex-col">
      {/* Title */}
      {title && (
        <div className="w-full py-10 px-8">
          <div className="text-3xl font-extrabold text-white mb-2">{title}</div>
        </div>
      )}
      {/* Content Row */}
      <div className="flex flex-row w-full px-8 gap-8 items-stretch">
        {/* Left: Image */}
        <div className="w-[70%] flex items-center justify-center rounded-lg overflow-hidden bg-gray-900" style={{ height: '600px' }}>
          <img
            src={selectedImage}
            alt="content"
            className="object-contain w-full h-full transition-all duration-200"
          />
        </div>
        {/* Right: Description */}
        <div className="w-[30%] flex flex-col justify-start pt-2">
          {description && (
            <div className="text-lg text-gray-100">{description}</div>
          )}
        </div>
      </div>
      {/* Swiper Carousel (thumbnails) */}
      <div className="w-full px-8 mt-8 mb-8">
        <div className="w-[70%]">
          <Swiper
            modules={[Navigation]}
            navigation
            spaceBetween={-400}
            slidesPerView={4}
            className="rounded-xl !pl-12 !pr-12"
          >
            {images.map((thumb, i) => (
              <SwiperSlide key={i}>
                <img
                  src={thumb}
                  alt={`Thumbnail ${i + 1}`}
                  className={`cursor-pointer w-28 h-28 object-cover rounded-lg border-4 transition-all duration-200 ${selectedImage === thumb ? "border-blue-500" : "border-transparent"}`}
                  onClick={() => setSelectedImage(thumb)}
                />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetails;
