import { Album } from "@shared/schema";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface AlbumCardProps {
  album: Album;
}

export function AlbumCard({ album }: AlbumCardProps) {
  // Get the cover photo for this album
  const { data: albumPhotos, isLoading } = useQuery({
    queryKey: [`/api/albums/${album.id}/photos`],
  });
  
  const coverPhoto = album.coverPhotoId && albumPhotos 
    ? albumPhotos.find(photo => photo.id === album.coverPhotoId) 
    : (albumPhotos && albumPhotos.length > 0 ? albumPhotos[0] : null);
  
  const getPhotoUrl = (photoId: number) => {
    // In a real implementation, this would fetch from the media endpoint
    // Since we can't get a real file without a real file path, we'll use a placeholder
    return `https://via.placeholder.com/500x160?text=${encodeURIComponent(album.name)}`;
  };
  
  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return format(new Date(date), "MMMM yyyy");
  };
  
  if (isLoading) {
    return (
      <div className="album-card bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="relative h-40 overflow-hidden">
          <Skeleton className="h-full w-full" />
        </div>
        <div className="p-3">
          <div className="flex -space-x-2">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="w-8 h-8 rounded-full" />
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <Link href={`/albums/${album.id}`}>
      <a className="album-card bg-white rounded-xl shadow-sm overflow-hidden block">
        <div className="relative h-40 overflow-hidden">
          <img 
            src={coverPhoto ? getPhotoUrl(coverPhoto.id) : `https://via.placeholder.com/500x160?text=${encodeURIComponent(album.name)}`} 
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
            {albumPhotos && albumPhotos.slice(0, 3).map((photo, index) => (
              <div 
                key={index} 
                className="w-8 h-8 rounded-full border-2 border-white bg-neutral-100 flex items-center justify-center" 
                style={{ zIndex: 3 - index }}
              >
                <img 
                  src={getPhotoUrl(photo.id)} 
                  alt="" 
                  className="w-full h-full rounded-full object-cover" 
                />
              </div>
            ))}
            {albumPhotos && albumPhotos.length > 3 && (
              <div className="w-8 h-8 rounded-full border-2 border-white bg-neutral-100 flex items-center justify-center text-xs text-neutral-600 font-medium" style={{ zIndex: 0 }}>
                +{albumPhotos.length - 3}
              </div>
            )}
            {(!albumPhotos || albumPhotos.length === 0) && (
              <div className="text-sm text-neutral-500">No photos</div>
            )}
          </div>
        </div>
      </a>
    </Link>
  );
}
