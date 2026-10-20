import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import ProjectDetails, {
  type ProjectDetailsProps,
} from "components/organisms/project-details/project-details";

interface ProjectDialogProps {
  project: ProjectDetailsProps;
  onClose: () => void;
}

export default function ProjectDialog({
  project,
  onClose,
}: ProjectDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const opener = document.activeElement;
    const { scrollX, scrollY } = window;
    const previousStyles = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };

    Object.assign(document.body.style, {
      position: "fixed",
      top: `-${scrollY}px`,
      left: `-${scrollX}px`,
      width: "100%",
      overflow: "hidden",
    });
    dialog.showModal();

    return () => {
      dialog.querySelectorAll("video").forEach((video) => video.pause());
      dialog.close();
      Object.assign(document.body.style, previousStyles);
      window.scrollTo(scrollX, scrollY);
      if (opener instanceof HTMLElement) opener.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={(event) => {
        if (!event.currentTarget.open) onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        ) {
          onClose();
        }
      }}
      className="fixed inset-0 m-0 h-[100dvh] max-h-none w-full max-w-none overflow-hidden border-0 bg-gray-900 p-0 text-white backdrop:bg-black/75 open:flex open:flex-col md:m-auto md:h-auto md:max-h-[90dvh] md:w-[calc(100%-4rem)] md:max-w-6xl md:rounded-2xl md:border md:border-gray-700 md:shadow-2xl"
    >
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-700 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-6">
        <h2 id={titleId} className="text-lg font-semibold">
          {project.title} 포트폴리오
        </h2>
        <button
          type="button"
          autoFocus
          aria-label="상세 보기 닫기"
          onClick={onClose}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-gray-200 hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
        >
          <XMarkIcon className="h-6 w-6" aria-hidden="true" />
        </button>
      </header>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6">
        <ProjectDetails {...project} />
      </div>
    </dialog>,
    document.body,
  );
}
