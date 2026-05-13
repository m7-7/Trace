import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { MemoryAlbums } from "@/components/memoryAlbums";
import { PhotoGallery } from "@/components/photoGallery";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useModal } from "@/lib/modalContext";
import { Folder } from "@shared/schema";

export default function Home() {
  const [location] = useLocation();
  const searchString = useSearch();
  const { openModal } = useModal();

  // Parse search params from the query string (useLocation returns pathname only in wouter v3)
  const searchParams = new URLSearchParams(searchString);
  const searchQuery = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const folderIdParam = searchParams.get('folder');
  const folderId = folderIdParam ? parseInt(folderIdParam) : undefined;

  const { data: folders = [] } = useQuery<Folder[]>({
    queryKey: ['/api/folders'],
    enabled: folderId !== undefined,
  });
  const activeFolder = folderId !== undefined ? folders.find(f => f.id === folderId) : undefined;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-neutral-50">
        <Header />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 app-content">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100">
              {activeFolder ? activeFolder.name : "Your Memories"}
            </h1>
            <Button onClick={() => openModal("createAlbum")}>
              <svg xmlns="http://www.w3.org/2000/svg" className="mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Create Memory
            </Button>
          </div>
          {!folderId && <MemoryAlbums />}
          <PhotoGallery
            searchQuery={searchQuery}
            category={category}
            folderId={folderId}
            folderName={activeFolder?.name}
          />
        </main>
      </div>
    </div>
  );
}
