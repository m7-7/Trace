import { AlbumWithPreview } from "@shared/schema";
import { Link } from "wouter";
import { format } from "date-fns";

interface AlbumCardProps {
  album: AlbumWithPreview;
}

export function AlbumCard({ album }: AlbumCardProps) {
  const coverPhotoId = album.coverPhotoId ?? album.previewPhotoIds[0] ?? null;

  const coverSrc = coverPhotoId
    ? `/api/media/${coverPhotoId}`
    : `https://via.placeholder.com/500x160?text=${encodeURIComponent(album.name)}`;

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return format(new Date(date), "MMMM yyyy");
  };

  return (
    <Link href={`/albums/${album.id}`}>
      <a className="album-card bg-white rounded-xl shadow-sm overflow-hidden block">
        <div className="relative h-40 overflow-hidden">
          <img
            src={coverSrc}
            alt={album.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
          <div className="absolute bottom-0 left-0 p-3">
            <h3 className="text-white font-medium">{album.name}</h3>
            <p className="text-white/80 text-sm">
              {formatDate(album.createdAt)}
            </p>
          </div>
        </div>
        <div className="p-3">
          <div className="flex -space-x-2">
            {album.previewPhotoIds.slice(0, 3).map((photoId, index) => (
              <div
                key={photoId}
                className="w-8 h-8 rounded-full border-2 border-white bg-neutral-100 flex items-center justify-center"
                style={{ zIndex: 3 - index }}
              >
                <img
                  src={`/api/media/${photoId}`}
                  alt=""
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
            ))}
            {album.photoCount > 3 && (
              <div
                className="w-8 h-8 rounded-full border-2 border-white bg-neutral-100 flex items-center justify-center text-xs text-neutral-600 font-medium"
                style={{ zIndex: 0 }}
              >
                +{album.photoCount - 3}
              </div>
            )}
            {album.photoCount === 0 && (
              <div className="text-sm text-neutral-500">No photos</div>
            )}
          </div>
        </div>
      </a>
    </Link>
  );
}
