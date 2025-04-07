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
    // In a real implementation, this would fetch from the media endpoint
    // Since we can't get a real file without a real file path, we'll use a placeholder
    return `https://via.placeholder.com/400x300?text=${encodeURIComponent(photo.fileName)}`;
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
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button 
            className="p-1 rounded-full bg-white/80 text-neutral-700 hover:bg-white" 
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            onClick={handleToggleFavorite}
            disabled={isLoading}
          >
            {isFavorite ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
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
