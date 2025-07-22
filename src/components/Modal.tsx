import React from "react";
import ProjectDetails from "./organisms/project-details/project-details";

interface ModalProps {
  index: number;
  imageUrl?: string | null;
  open: boolean;
  onClose: () => void;
}

const modalHeaders = [
  "ITEM Trading PRE-SALE",
  "결제 연동",
  "코인 개발",
  "API·플랫폼",
  "데이터 분석",
  "툴·자동화"
];
const modalDescriptions = [
  "This is a pre-sale sample page for the DS.WAR LAND ITEM event. Buy items using USDT or lucky box tokens.",
  "여기에 결제 연동 관련 문서 내용을 적으세요.",
  "여기에 코인 개발 관련 문서 내용을 적으세요.",
  "여기에 API·플랫폼 관련 문서 내용을 적으세요.",
  "여기에 데이터 분석 관련 문서 내용을 적으세요.",
  "여기에 툴·자동화 관련 문서 내용을 적으세요."
];

const thumbnails = [
  [
    "/images/projects/dswar/one-ex.png",
    "/images/projects/dswar/two-ex.png",
    "/images/projects/dswar/three-ex.png",
    "/images/projects/dswar/shini-ex.png",
    "/images/projects/dswar/dswar-ex.png"
  ],
  [],
  [],
  [],
  [],
  []
];


export const Modal: React.FC<ModalProps> = ({
  index,
  imageUrl,
  open,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      className="
    fixed inset-y-0
    left-0 right-0
    lg:left-[550px] lg:right-[550px]
    bg-black bg-opacity-90
    flex items-start justify-center z-50
  "
      onClick={onClose}
    >
      <div
        className="relative rounded-xl w-full h-auto flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          className="absolute top-6 right-10 text-gray-300 text-2xl z-10"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>
        {/* Render ProjectDetails */}
        <ProjectDetails
  title={modalHeaders[index]}
  description={modalDescriptions[index]}
  images={thumbnails[index] ?? []}
  initialImage={imageUrl ?? (thumbnails[index]?.[0] ?? null)}
/>

      </div>
    </div>
  );
};
