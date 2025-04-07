import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { MemoryAlbums } from "@/components/memoryAlbums";
import { PhotoGallery } from "@/components/photoGallery";
import { useLocation } from "wouter";

export default function Home() {
  const [location] = useLocation();
  
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
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <MemoryAlbums />
          <PhotoGallery searchQuery={searchQuery} category={category} />
        </main>
      </div>
    </div>
  );
}
