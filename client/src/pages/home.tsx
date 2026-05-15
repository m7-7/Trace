import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { MemoryAlbums } from "@/components/memoryAlbums";
import { PhotoGallery } from "@/components/photoGallery";
import { useLocation, useSearch } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useModal } from "@/lib/modalContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Folder } from "@shared/schema";

export default function Home() {
  const [location] = useLocation();
  const searchString = useSearch();
  const { openModal } = useModal();
  const [isScanning, setIsScanning] = useState(false);

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

  const handleSyncFolder = async () => {
    if (isScanning || !folderId || !activeFolder) return;
    setIsScanning(true);

    const previousTimestamp = activeFolder.lastScanned instanceof Date
      ? activeFolder.lastScanned.getTime()
      : activeFolder.lastScanned
        ? new Date(activeFolder.lastScanned as any).getTime()
        : 0;

    try {
      await apiRequest("POST", `/api/folders/${folderId}/scan`);

      const POLL_INTERVAL = 3000;
      const MAX_POLLS = 30;
      let polls = 0;

      const check = async () => {
        polls++;
        try {
          const res = await fetch("/api/folders");
          const allFolders: any[] = await res.json();
          const updated = allFolders.find((f: any) => f.id === folderId);
          const updatedTs = updated?.lastScanned
            ? new Date(updated.lastScanned).getTime()
            : 0;

          if (updatedTs > previousTimestamp) {
            await queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
            await queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
            const photosRes = await fetch("/api/photos");
            const photos: any[] = await photosRes.json();
            const folderPath = activeFolder.path;
            const count = Array.isArray(photos)
              ? photos.filter(
                  (p: any) =>
                    typeof p.filePath === "string" &&
                    p.filePath.startsWith(folderPath)
                ).length
              : 0;

            if (count > 0) {
              toast({ title: "Folder synced", description: `${count} photo${count === 1 ? "" : "s"} in this folder.` });
            } else {
              toast({ title: "No new photos found" });
            }
            setIsScanning(false);
            return;
          }
        } catch {
          // network hiccup — keep polling
        }

        if (polls < MAX_POLLS) {
          setTimeout(check, POLL_INTERVAL);
        } else {
          toast({ title: "Still scanning…", description: "Check back in a moment." });
          setIsScanning(false);
        }
      };

      setTimeout(check, POLL_INTERVAL);
    } catch {
      toast({ title: "Couldn't sync folder", description: "Please try again.", variant: "destructive" });
      setIsScanning(false);
    }
  };

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
            <div className="flex items-center gap-2">
              {folderId && (
                <Button variant="outline" onClick={handleSyncFolder} disabled={isScanning}>
                  {isScanning ? "Looking for new photos…" : "Sync Folder"}
                </Button>
              )}
              <Button onClick={() => openModal("createAlbum")}>
                <svg xmlns="http://www.w3.org/2000/svg" className="mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Create Memory
              </Button>
            </div>
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
