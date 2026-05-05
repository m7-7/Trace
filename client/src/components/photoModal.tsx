import { Photo } from "@shared/schema";
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { X, ChevronLeft, ChevronRight, Star, Calendar, HardDrive, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PhotoModalProps {
  photo: Photo;
  allPhotos?: Photo[];
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
}

export function PhotoModal({ photo, allPhotos, onClose, isFavorite, onToggleFavorite }: PhotoModalProps) {
  const photos = allPhotos ?? [photo];
  const [currentIndex, setCurrentIndex] = useState(photos.findIndex(p => p.id === photo.id));
  const current = photos[currentIndex] ?? photo;

  const goNext = useCallback(() => setCurrentIndex(i => Math.min(i + 1, photos.length - 1)), [photos.length]);
  const goPrev = useCallback(() => setCurrentIndex(i => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goNext, goPrev]);

  const displayName = current.fileName
    .replace(/_conv\.jpg$/i, "")
    .replace(/^import_\d+_\d+_/, "")
    .replace(/\.(jpg|jpeg|png|heic|webp)$/i, "")
    .replace(/_/g, " ");

  const dateLabel = format(new Date(current.createdAt), "MMMM d, yyyy");
  const fileSizeLabel = current.fileSize
    ? current.fileSize > 1024 * 1024
      ? `${(current.fileSize / 1024 / 1024).toFixed(1)} MB`
      : `${(current.fileSize / 1024).toFixed(0)} KB`
    : null;

  const relevantTags = (current.contentTags ?? []).filter(t => !t.startsWith("from:") && t !== "imported");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal container */}
      <div
        className="relative flex w-full max-w-5xl max-h-[90vh] mx-4 rounded-2xl overflow-hidden bg-neutral-900 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Image pane */}
        <div className="relative flex-1 flex items-center justify-center bg-black min-w-0">
          <img
            key={current.id}
            src={`/api/media/${current.id}`}
            alt={displayName}
            className="max-h-[90vh] max-w-full object-contain"
          />

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Prev / Next arrows */}
          {currentIndex > 0 && (
            <button
              onClick={goPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {currentIndex < photos.length - 1 && (
            <button
              onClick={goNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}

          {/* Counter */}
          {photos.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 text-white text-xs">
              {currentIndex + 1} / {photos.length}
            </div>
          )}
        </div>

        {/* Info sidebar */}
        <div className="w-64 shrink-0 flex flex-col bg-neutral-900 border-l border-neutral-800 p-5 overflow-y-auto">
          {/* Name + favorite */}
          <div className="flex items-start justify-between gap-2 mb-4">
            <h2 className="text-white font-semibold text-sm leading-snug capitalize flex-1">{displayName}</h2>
            <button onClick={onToggleFavorite} className="shrink-0 mt-0.5">
              <Star
                className={`h-5 w-5 transition-colors ${isFavorite ? "text-yellow-400 fill-yellow-400" : "text-neutral-500 hover:text-yellow-400"}`}
              />
            </button>
          </div>

          <div className="space-y-3 text-sm">
            {/* Date */}
            <div className="flex items-start gap-2.5">
              <Calendar className="h-4 w-4 text-neutral-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-neutral-400 text-xs mb-0.5">Date taken</p>
                <p className="text-white">{dateLabel}</p>
              </div>
            </div>

            {/* File size */}
            {fileSizeLabel && (
              <div className="flex items-start gap-2.5">
                <HardDrive className="h-4 w-4 text-neutral-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-neutral-400 text-xs mb-0.5">File size</p>
                  <p className="text-white">{fileSizeLabel}</p>
                </div>
              </div>
            )}

            {/* Tags */}
            {relevantTags.length > 0 && (
              <div className="flex items-start gap-2.5">
                <Tag className="h-4 w-4 text-neutral-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-neutral-400 text-xs mb-1.5">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {relevantTags.map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 bg-neutral-800 rounded-full text-neutral-300 text-xs capitalize">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Location */}
            {current.location && (
              <div className="flex items-start gap-2.5">
                <div className="h-4 w-4 text-neutral-500 mt-0.5 shrink-0 text-center text-xs">📍</div>
                <div>
                  <p className="text-neutral-400 text-xs mb-0.5">Location</p>
                  <p className="text-white">{current.location}</p>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {current.description && !current.description.startsWith("Imported from") && (
            <p className="mt-4 pt-4 border-t border-neutral-800 text-neutral-400 text-xs leading-relaxed">
              {current.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
