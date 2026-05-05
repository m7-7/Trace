import { Photo } from "@shared/schema";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface PhotoCardProps {
  photo: Photo;
}

export function PhotoCard({ photo }: PhotoCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(photo.favorite);
  
  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsLoading(true);
    try {
      const response = await apiRequest("PUT", `/api/photos/${photo.id}/favorite`, null);
      const updatedPhoto = await response.json();
      
      setIsFavorite(updatedPhoto.favorite);
      
      // Update local cache
      queryClient.invalidateQueries({ queryKey: ['/api/photos'] });
      
      toast({
        title: updatedPhoto.favorite ? "Added to Favorites" : "Removed from Favorites",
        description: `"${photo.fileName}" has been ${updatedPhoto.favorite ? "added to" : "removed from"} your favorites`,
      });
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast({
        title: "Error",
        description: "Failed to update favorite status",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const getPhotoUrl = () => {
    return `/api/media/${photo.id}`;
  };
  
  const formatDate = (date: Date) => {
    return format(new Date(date), "MMMM d, yyyy");
  };
  
  return (
    <div className="photo-card rounded-lg overflow-hidden shadow-sm">
      <div className="relative aspect-[4/3] group">
        <img 
          src={getPhotoUrl()} 
          alt={photo.fileName} 
          className="w-full h-full object-cover" 
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200"></div>
        <div className={`absolute top-2 right-2 transition-opacity duration-200 ${isFavorite ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          <button 
            className={`p-1 rounded-full bg-white/80 hover:bg-white ${isFavorite ? "text-yellow-500" : "text-neutral-700"}`}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            onClick={handleToggleFavorite}
            disabled={isLoading}
          >
            {isFavorite ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
            )}
          </button>
        </div>
      </div>
      <div className="p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-500">{formatDate(photo.createdAt)}</span>
          <div className="flex space-x-1">
            {photo.contentTags && photo.contentTags.slice(0, 2).map((tag, index) => (
              <span key={index} className="inline-block px-1.5 py-0.5 bg-neutral-100 rounded text-xs text-neutral-600">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
