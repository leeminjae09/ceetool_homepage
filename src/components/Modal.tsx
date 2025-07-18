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
  "", "", "", "", ""
];
const modalDescriptions = [
  "This is a pre-sale sample page for the DS.WAR LAND ITEM event. Buy items using USDT or lucky box tokens.",
  "", "", "", "", ""
];

const thumbnails = [
  "/images/projects/dswar/one-ex.png",
  "/images/projects/dswar/two-ex.png",
  "/images/projects/dswar/three-ex.png",
  "/images/projects/dswar/shini-ex.png",
  "/images/projects/dswar/dswar-ex.png",
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
      className="fixed inset-y-0 left-[550px] right-[550px] bg-black bg-opacity-90 flex items-start justify-center z-50"
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
          images={thumbnails}
          initialImage={imageUrl ?? thumbnails[0]}
        />
      </div>
    </div>
  );
};
