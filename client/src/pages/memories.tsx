import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { useQuery } from "@tanstack/react-query";
import { Album } from "@shared/schema";
import { AlbumCard } from "@/components/albumCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useContext } from "react";
import { AppContext } from "@/App";

export default function Memories() {
  const { openModal } = useContext(AppContext);
  const { data: albums = [], isLoading } = useQuery<Album[]>({
    queryKey: ['/api/albums'],
  });
  
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-neutral-50">
        <Header />
        
        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-neutral-800">Memory Albums</h1>
            <Button onClick={() => openModal("createAlbum")}>
              <svg xmlns="http://www.w3.org/2000/svg" className="mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Create Memory
            </Button>
          </div>
          
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
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
          ) : albums.length === 0 ? (
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
              <Button onClick={() => openModal("createAlbum")}>Create Memory Album</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {albums.map((album) => (
                <AlbumCard key={album.id} album={album} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
