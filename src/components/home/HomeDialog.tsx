"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function HomeDialog({
  title,
  onClose,
  children,
  className,
  hideHeading = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  hideHeading?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={cn("sx-dialog", className)}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
        }
      }}
    >
      {!hideHeading && <div className="sx-dialog-heading">
        <h2>{title}</h2>
        <button type="button" className="sx-icon-button" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}><X size={21} /></button>
      </div>}
      {children}
    </dialog>
  );
}
