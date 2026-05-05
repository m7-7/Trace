import { useQuery } from "@tanstack/react-query";
import { Photo } from "@shared/schema";
import { useState } from "react";
import { PhotoCard } from "./photoCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PhotoGalleryProps {
  searchQuery?: string;
  category?: string;
  albumId?: number;
  favoritesOnly?: boolean;
}

export function PhotoGallery({
  searchQuery,
  category,
  albumId,
  favoritesOnly = false
}: PhotoGalleryProps) {
  const [limit, setLimit] = useState(24);
  const [timeFilter, setTimeFilter] = useState("all");
  
  // Build the query key based on filters
  let queryKey = ['/api/photos'];
  let queryParams: Record<string, string> = {};
  
  if (limit) {
    queryParams.limit = limit.toString();
  }
  
  if (searchQuery) {
    queryParams.q = searchQuery;
    queryKey = ['/api/photos/search'];
  }
  
  if (timeFilter !== 'all') {
    const now = new Date();
    let startDate = new Date();
    
    switch (timeFilter) {
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
    }
    
    queryParams.startDate = startDate.toISOString();
    queryParams.endDate = now.toISOString();
  }
  
  if (category) {
    queryParams.category = category;
  }
  
  // For album photos, use a different endpoint
  if (albumId) {
    queryKey = [`/api/albums/${albumId}/photos`];
  }
  
  // For favorites, filter after fetching
  const { data: photos = [], isLoading } = useQuery<Photo[]>({
    queryKey: [
      queryKey[0],
      queryParams
    ],
  });
  
  // Apply favorites filter if requested
  const filteredPhotos = favoritesOnly 
    ? photos.filter(photo => photo.favorite)
    : photos;
  
  const loadMore = () => {
    setLimit(prev => prev + 24);
  };
  
  if (isLoading) {
    return (
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-neutral-700">
            {albumId ? "Album Photos" : favoritesOnly ? "Favorite Photos" : "All Photos"}
          </h2>
          
          <div className="flex items-center space-x-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
            <div key={i} className="rounded-lg overflow-hidden shadow-sm">
              <Skeleton className="aspect-[4/3] w-full" />
              <div className="p-2">
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }
  
  // Empty state
  if (filteredPhotos.length === 0) {
    return (
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-neutral-700">
            {albumId ? "Album Photos" : favoritesOnly ? "Favorite Photos" : "All Photos"}
          </h2>
        </div>
        
        <div className="bg-white rounded-xl p-8 text-center border border-dashed border-neutral-200">
          <div className="mb-4 inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary-50 text-primary-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>
          <h3 className="text-lg font-medium text-neutral-700 mb-1">
            {favoritesOnly 
              ? "No Favorite Photos Yet"
              : searchQuery 
                ? "No Photos Match Your Search"
                : albumId
                  ? "No Photos in This Album"
                  : "No Photos Found"
            }
          </h3>
          <p className="text-neutral-500 mb-4">
            {favoritesOnly 
              ? "Mark some photos as favorites"
              : searchQuery 
                ? "Try different search terms"
                : "Add a folder to scan for photos"
            }
          </p>
        </div>
      </section>
    );
  }
  
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-neutral-700">
          {albumId ? "Album Photos" : favoritesOnly ? "Favorite Photos" : "All Photos"}
        </h2>
        
        {/* Filter Controls */}
        <div className="flex items-center space-x-2">
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
            </SelectContent>
          </Select>
          
          <button className="p-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50" title="View options">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </button>
        </div>
      </div>
      
      {/* Photo Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredPhotos.map(photo => (
          <PhotoCard key={photo.id} photo={photo} allPhotos={filteredPhotos} />
        ))}
      </div>
      
      {/* Load More Button */}
      {filteredPhotos.length >= limit && (
        <div className="mt-8 text-center">
          <Button 
            variant="outline" 
            onClick={loadMore}
            className="px-4 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-600 hover:bg-neutral-50 font-medium"
          >
            Load More Photos
          </Button>
        </div>
      )}
    </section>
  );
}
