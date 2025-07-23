import React from "react";
import ProjectDetails from "./organisms/project-details/project-details";

// 1. ModalProps interface
interface ModalProps {
  index: number;
  imageUrl?: string | null;
  open: boolean;
  onClose: () => void;
}

// 2. Your data arrays
const modalHeaders = [
  "NFT Market",
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

// 3. Each modal's content as a function
const modalContents = [
  // Modal 0: DS.WAR & SHINI
    () => (
    <>
      <ProjectDetails
        title={modalHeaders[0]}
        description={modalDescriptions[0]}
        images={thumbnails[0]}
        initialImage="/images/projects/dswar/dswar-ex.png"
      />
      <ProjectDetails
        title="SHINI Homepage"
        description="신이 is a major South Korean cleaning franchise with over 3,000 locations nationwide.
The company offers professional cleaning services, emphasizing quick response and high-quality work performed by trained staff.
Customers can conveniently book their services through KakaoTalk or the website."
        images={[
          "/images/projects/shini/shini-ex4.mp4",
          "/images/projects/shini/shini-ex2.jpg",
          "/images/projects/shini/shini-ex3.jpg"
        ]}
        initialImage="/images/projects/shini/shini-ex4.mp4"
        videoThumb="/images/projects/shini/shini-ex1.jpg"
      />
    </>
  ),
  // Modal 1: C9PRO
  () => (
    <>
      <ProjectDetails
        title="c9-Pro"
        description={modalDescriptions[0]}
        images={[
          "/images/projects/c9pro/c9pro-ex1.mp4",
          "/images/projects/c9pro/c9pro-ex2.png",
          "/images/projects/c9pro/c9pro-ex3.png",
          "/images/projects/c9pro/c9pro-ex4.png"
        ]}
        initialImage="/images/projects/c9pro/c9pro-ex1.mp4"
        videoThumb="/images/projects/c9pro/c9pro-ex5.png"
      />
    </>
  ),
  // Modal 2: Placeholder
  () => (
    <div className="text-white p-8">No details for this modal yet.</div>
  ),
  // Modal 3: Placeholder
  () => (
    <div className="text-white p-8">No details for this modal yet.</div>
  ),
  // Modal 4: Placeholder
  () => (
    <div className="text-white p-8">No details for this modal yet.</div>
  ),
  // Modal 5: Placeholder
  () => (
    <div className="text-white p-8">No details for this modal yet.</div>
  ),
];

// 4. The Modal component (THIS IS THE IMPORTANT PART)
export const Modal: React.FC<ModalProps> = ({ index, open, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-start justify-center z-50"
      onClick={onClose}
    >
      <div
        className="relative rounded-xl bg-black bg-opacity-90 max-w-[90rem] w-full h-auto flex flex-col overflow-y-auto max-h-[95vh]"
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
        {/* Render your custom content for each modal */}
        {modalContents[index]?.()}
      </div>
    </div>
  );
};
