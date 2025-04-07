import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { MemoryAlbums } from "@/components/memoryAlbums";
import { PhotoGallery } from "@/components/photoGallery";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useModal } from "@/lib/modalContext";

export default function Home() {
  const [location] = useLocation();
  const { openModal } = useModal();
  
  // Parse search params
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const searchQuery = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-neutral-50">
        <Header />
        
        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 app-content">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100">Your Memories</h1>
            <Button onClick={() => openModal("createAlbum")}>
              <svg xmlns="http://www.w3.org/2000/svg" className="mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Create Memory
            </Button>
          </div>
          <MemoryAlbums />
          <PhotoGallery searchQuery={searchQuery} category={category} />
        </main>
      </div>
    </div>
  );
}
