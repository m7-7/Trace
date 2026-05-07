import { useQuery } from "@tanstack/react-query";
import { AlbumWithPreview } from "@shared/schema";
import { Link } from "wouter";
import { AlbumCard } from "./albumCard";
import { Skeleton } from "@/components/ui/skeleton";

export function MemoryAlbums() {
  const { data: albums = [], isLoading } = useQuery<AlbumWithPreview[]>({
    queryKey: ['/api/albums'],
  });
  
  if (isLoading) {
    return (
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-neutral-700">Recent Memories</h2>
          <div className="text-sm text-primary-500 hover:text-primary-600 font-medium">View All</div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <Skeleton className="h-40 w-full" />
              <div className="p-3">
                <div className="flex space-x-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }
  
  // If no albums, show empty state
  if (albums.length === 0) {
    return (
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-neutral-700">Recent Memories</h2>
        </div>
        
        <div className="bg-white rounded-xl p-8 text-center border border-dashed border-neutral-200">
          <div className="mb-4 inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary-50 text-primary-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <h3 className="text-lg font-medium text-neutral-700 mb-1">No Memory Albums Yet</h3>
          <p className="text-neutral-500 mb-4">Create your first memory album by searching for photos</p>
        </div>
      </section>
    );
  }
  
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-neutral-700">Recent Memories</h2>
        <Link href="/memories" className="text-sm text-primary-500 hover:text-primary-600 font-medium">View All</Link>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {albums.slice(0, 4).map((album) => (
          <AlbumCard key={album.id} album={album} />
        ))}
      </div>
    </section>
  );
}
