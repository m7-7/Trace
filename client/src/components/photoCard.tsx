import { Photo } from "@shared/schema";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Star } from "lucide-react";
import { PhotoModal } from "./photoModal";

interface PhotoCardProps {
  photo: Photo;
  allPhotos?: Photo[];
}

export function PhotoCard({ photo, allPhotos }: PhotoCardProps) {
  const [isFavorite, setIsFavorite] = useState(photo.favorite);
  const [isTogglingFav, setIsTogglingFav] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsTogglingFav(true);
    try {
      const res = await apiRequest(
        "PUT",
        `/api/photos/${photo.id}/favorite`,
        null,
      );
      const updated = await res.json();
      setIsFavorite(updated.favorite);
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/photos/favorites"] });
    } catch {
      toast({
        title: "Error",
        description: "Could not update favorite",
        variant: "destructive",
      });
    } finally {
      setIsTogglingFav(false);
    }
  };

  const displayName = photo.fileName
    .replace(/_conv\.jpg$/i, "")
    .replace(/^import_\d+_\d+_/, "")
    .replace(/\.(jpg|jpeg|png|heic|webp)$/i, "")
    .replace(/_/g, " ");

  const dateLabel = format(new Date(photo.createdAt), "MMM d, yyyy");

  return (
    <>
      <div
        className="group relative rounded-xl overflow-hidden bg-neutral-100 cursor-pointer shadow-sm hover:shadow-md transition-shadow"
        onClick={() => setModalOpen(true)}
      >
        <div className="aspect-[4/3]">
          <img
            src={`/api/media/${photo.id}`}
            alt={displayName}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            style={photo.rotation ? { transform: `rotate(${photo.rotation}deg)` } : undefined}
            loading="lazy"
          />
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

        {/* Favorite button */}
        <button
          onClick={handleToggleFavorite}
          disabled={isTogglingFav}
          className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-sm transition-all duration-200
            ${
              isFavorite
                ? "bg-white/90 text-yellow-500 opacity-100"
                : "bg-black/30 text-white opacity-0 group-hover:opacity-100"
            }`}
        >
          <Star
            className="h-3.5 w-3.5"
            fill={isFavorite ? "currentColor" : "none"}
          />
        </button>

        {/* Info bar — visible on hover */}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <p className="text-white text-xs font-medium truncate leading-tight">
            {displayName}
          </p>
          <p className="text-white/70 text-[11px] mt-0.5">{dateLabel}</p>
        </div>
      </div>

      {modalOpen && (
        <PhotoModal
          photo={photo}
          allPhotos={allPhotos}
          onClose={() => setModalOpen(false)}
          isFavorite={!!isFavorite}
          onToggleFavorite={handleToggleFavorite}
        />
      )}
    </>
  );
}
