import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Folder } from "@shared/schema";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { useModal, ModalType } from "@/lib/modalContext";

const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;

const FOLDER_LIMIT = 5;

export function Sidebar() {
  const [location] = useLocation();
  const searchString = useSearch();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const [newFolderPath, setNewFolderPath] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [showAllFolders, setShowAllFolders] = useState(false);
  const { openModal } = useModal();

  // Get folders from API
  const { data: folders = [] } = useQuery<Folder[]>({
    queryKey: ['/api/folders'],
  });

  // useLocation() returns pathname only in wouter v3; useSearch() provides the query string
  const currentFolderId = new URLSearchParams(searchString).get('folder');

  const isActive = (path: string) => {
    if (path === '/' && currentFolderId) return false;
    return location === path;
  };

  const sortedFolders = [...folders].sort((a, b) => a.name.localeCompare(b.name));
  const activeFolderIndex = currentFolderId
    ? sortedFolders.findIndex(f => f.id.toString() === currentFolderId)
    : -1;
  const visibleFolders = showAllFolders
    ? sortedFolders
    : activeFolderIndex >= FOLDER_LIMIT
      ? [...sortedFolders.slice(0, FOLDER_LIMIT), sortedFolders[activeFolderIndex]]
      : sortedFolders.slice(0, FOLDER_LIMIT);
  const hiddenCount = sortedFolders.length - FOLDER_LIMIT;
  
  const toggleMobileMenu = () => {
    setIsMobileOpen(!isMobileOpen);
  };
  
  const handleBrowse = async () => {
    const picked = await window.electronAPI!.pickFolder();
    if (picked) setNewFolderPath(picked);
  };

  const handleAddFolder = async () => {
    if (!newFolderPath.trim() || !newFolderName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both a name and a path for the folder",
        variant: "destructive"
      });
      return;
    }

    try {
      const folderRes = await apiRequest("POST", "/api/folders", {
        path: newFolderPath.trim(),
        name: newFolderName.trim(),
        active: true
      });
      const folder = await folderRes.json();
      const folderPath: string = folder.path ?? newFolderPath.trim();

      queryClient.invalidateQueries({ queryKey: ['/api/folders'] });
      setAddFolderOpen(false);
      setNewFolderPath("");
      setNewFolderName("");

      // Trigger background scan (server returns 202 immediately; TF inference per
      // image means large folders take minutes — we poll lastScanned to detect completion).
      await apiRequest("POST", `/api/folders/${folder.id}/scan`);

      toast({
        title: `Scanning "${folder.name}"…`,
        description: "Photos will appear in All Photos when the scan completes.",
      });

      // Poll GET /api/folders every 3 s (up to 90 s) until lastScanned becomes
      // non-null for this folder, then show the real photo count.
      const POLL_INTERVAL = 3000;
      const MAX_POLLS = 30;
      let polls = 0;

      const check = async () => {
        polls++;
        try {
          const res = await fetch("/api/folders");
          const allFolders: any[] = await res.json();
          const updated = allFolders.find((f: any) => f.id === folder.id);

          if (updated?.lastScanned) {
            // Scan complete — count photos whose filePath lives under this folder.
            await queryClient.invalidateQueries({ queryKey: ['/api/photos'] });
            const photosRes = await fetch("/api/photos");
            const photos: any[] = await photosRes.json();
            const count = Array.isArray(photos)
              ? photos.filter((p: any) => typeof p.filePath === "string" && p.filePath.startsWith(folderPath)).length
              : 0;

            if (count > 0) {
              toast({
                title: "Scan complete",
                description: `${count} photo${count === 1 ? "" : "s"} imported from "${folder.name}".`,
              });
            } else {
              toast({
                title: "Scan complete — 0 photos found",
                description: `No supported images were found in "${folder.name}". The folder may be empty or contain unsupported file types.`,
                variant: "destructive",
              });
            }
            return; // done
          }
        } catch {
          // network hiccup — keep polling
        }

        if (polls < MAX_POLLS) {
          setTimeout(check, POLL_INTERVAL);
        } else {
          toast({
            title: "Still scanning…",
            description: `"${folder.name}" is taking a while. Check All Photos in a few minutes.`,
          });
        }
      };

      setTimeout(check, POLL_INTERVAL);
    } catch (error: any) {
      // Surface the server's error message (path not mounted, invalid root, etc.)
      let description = "Failed to add folder.";
      if (error instanceof Error) {
        try {
          const body = error.message.replace(/^\d+:\s*/, "");
          const parsed = JSON.parse(body);
          if (typeof parsed.message === "string") description = parsed.message;
        } catch {}
      }
      toast({ title: "Error", description, variant: "destructive" });
    }
  };
  
  return (
    <>
      <div 
        className={`sidebar app-sidebar fixed md:relative w-64 h-full bg-white border-r border-neutral-100 shadow-sm z-20 md:transform-none ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } transition-transform duration-300 ease-in-out`}
      >
        <div className="flex flex-col h-full">
          {/* Logo and App Name */}
          <div className="flex items-center p-4 border-b border-neutral-100 dark:border-gray-700">
            <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center">
              <span className="text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
                  <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
                  <line x1="6" y1="1" x2="6" y2="4"></line>
                  <line x1="10" y1="1" x2="10" y2="4"></line>
                  <line x1="14" y1="1" x2="14" y2="4"></line>
                </svg>
              </span>
            </div>
            <h1 className="ml-3 text-xl font-semibold text-neutral-700 dark:text-neutral-100">Trace</h1>
          </div>
          
          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto p-2">
            <div className="mb-4">
              <h2 className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-3 mb-2">Library</h2>
              <ul>
                <li>
                  <Link href="/">
                    <div className={`sidebar-link flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer ${isActive("/") ? "bg-primary-50 dark:bg-primary-900/40 text-primary-500 dark:text-primary-400 border-r-3 border-primary-500" : "hover:bg-neutral-50 dark:hover:bg-gray-800 dark:text-neutral-200"}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="text-[20px] mr-3 w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                      </svg>
                      All Photos
                    </div>
                  </Link>
                </li>
                <li>
                  <Link href="/memories">
                    <div className={`sidebar-link flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer ${isActive("/memories") ? "bg-primary-50 dark:bg-primary-900/40 text-primary-500 dark:text-primary-400 border-r-3 border-primary-500" : "hover:bg-neutral-50 dark:hover:bg-gray-800 dark:text-neutral-200"}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="text-[20px] mr-3 w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      Memories
                    </div>
                  </Link>
                </li>
                <li>
                  <Link href="/favorites">
                    <div className={`sidebar-link flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer ${isActive("/favorites") ? "bg-primary-50 dark:bg-primary-900/40 text-primary-500 dark:text-primary-400 border-r-3 border-primary-500" : "hover:bg-neutral-50 dark:hover:bg-gray-800 dark:text-neutral-200"}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="text-[20px] mr-3 w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                      </svg>
                      Favorites
                    </div>
                  </Link>
                </li>
                <li>
                  <Link href="/travel">
                    <div className={`sidebar-link flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer ${isActive("/travel") ? "bg-primary-50 dark:bg-primary-900/40 text-primary-500 dark:text-primary-400 border-r-3 border-primary-500" : "hover:bg-neutral-50 dark:hover:bg-gray-800 dark:text-neutral-200"}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="text-[20px] mr-3 w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                      </svg>
                      Travel your World
                    </div>
                  </Link>
                </li>
              </ul>
            </div>
            
            <div className="mb-4">
              <h2 className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-3 mb-2">Categories</h2>
              <ul>
                <li>
                  <Link href="/?category=nature">
                    <div className="sidebar-link flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-neutral-50 dark:hover:bg-gray-800 dark:text-neutral-200 cursor-pointer">
                      <svg xmlns="http://www.w3.org/2000/svg" className="text-[20px] mr-3 w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 18v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path>
                        <path d="M12 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"></path>
                      </svg>
                      Nature
                    </div>
                  </Link>
                </li>
                <li>
                  <Link href="/?category=food">
                    <div className="sidebar-link flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-neutral-50 dark:hover:bg-gray-800 dark:text-neutral-200 cursor-pointer">
                      <svg xmlns="http://www.w3.org/2000/svg" className="text-[20px] mr-3 w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
                        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
                        <line x1="6" y1="1" x2="6" y2="4"></line>
                        <line x1="10" y1="1" x2="10" y2="4"></line>
                        <line x1="14" y1="1" x2="14" y2="4"></line>
                      </svg>
                      Food
                    </div>
                  </Link>
                </li>
                <li>
                  <Link href="/?category=people">
                    <div className="sidebar-link flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-neutral-50 dark:hover:bg-gray-800 dark:text-neutral-200 cursor-pointer">
                      <svg xmlns="http://www.w3.org/2000/svg" className="text-[20px] mr-3 w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                      People
                    </div>
                  </Link>
                </li>
                <li>
                  <Link href="/?category=places">
                    <div className="sidebar-link flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-neutral-50 dark:hover:bg-gray-800 dark:text-neutral-200 cursor-pointer">
                      <svg xmlns="http://www.w3.org/2000/svg" className="text-[20px] mr-3 w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                      </svg>
                      Places
                    </div>
                  </Link>
                </li>
              </ul>
            </div>
            
            <div className="mb-4">
              <h2 className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-3 mb-2">Folders</h2>
              <ul>
                {visibleFolders.map(folder => (
                  <li key={folder.id}>
                    <Link href={`/?folder=${folder.id}`}>
                      <div className={`sidebar-link flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer ${currentFolderId === folder.id.toString() ? "bg-primary-50 dark:bg-primary-900/40 text-primary-500 dark:text-primary-400 border-r-3 border-primary-500" : "hover:bg-neutral-50 dark:hover:bg-gray-800 dark:text-neutral-200"}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="text-[20px] mr-3 w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <div className="flex flex-col overflow-hidden">
                          <span className="truncate">{folder.name}</span>
                          {(folder.displayPath) && (
                            <span className="text-xs text-neutral-400 dark:text-neutral-500 truncate" title={folder.displayPath}>
                              {folder.displayPath}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
                {hiddenCount > 0 && (
                  <li>
                    <button
                      onClick={() => setShowAllFolders(v => !v)}
                      className="flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-gray-800 w-full text-left"
                    >
                      {showAllFolders ? "Show less" : `${hiddenCount} more folder${hiddenCount === 1 ? "" : "s"}`}
                    </button>
                  </li>
                )}
                <li>
                  <button 
                    onClick={() => setAddFolderOpen(true)}
                    className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-primary-500 hover:bg-neutral-50 dark:hover:bg-gray-800 w-full text-left"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="text-[20px] mr-3 w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Folder
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => openModal("importFromUrl")}
                    className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-primary-500 hover:bg-neutral-50 dark:hover:bg-gray-800 w-full text-left"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="text-[20px] mr-3 w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Import from URL
                  </button>
                </li>
              </ul>
            </div>
          </nav>
          
        </div>
      </div>
      
      {/* Add Folder Dialog */}
      <Dialog open={addFolderOpen} onOpenChange={setAddFolderOpen}>
        <DialogContent className="sm:max-w-md dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Add Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label htmlFor="folder-name" className="text-sm font-medium dark:text-white">Folder Name</label>
              <Input
                id="folder-name"
                placeholder="e.g., Photos 2023"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="folder-path" className="text-sm font-medium dark:text-white">
                {isElectron ? "Local Folder Path" : "Container Path"}
              </label>
              <div className={isElectron ? "flex gap-2" : undefined}>
                <Input
                  id="folder-path"
                  placeholder={isElectron ? "/home/user/Pictures" : "/app/media/Pictures"}
                  value={newFolderPath}
                  onChange={(e) => setNewFolderPath(e.target.value)}
                  className="dark:bg-gray-800 dark:border-gray-700 dark:text-white font-mono text-sm"
                />
                {isElectron && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBrowse}
                    className="shrink-0 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:hover:bg-gray-700"
                  >
                    Browse…
                  </Button>
                )}
              </div>
              {isElectron ? (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Use Browse to pick a folder, or type the path directly.
                </p>
              ) : (
                <>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Path must be under <code className="bg-neutral-100 dark:bg-neutral-700 px-1 rounded">/app/media/</code> or <code className="bg-neutral-100 dark:bg-neutral-700 px-1 rounded">/app/uploads/</code>.
                    Mount your host folder first in <code className="bg-neutral-100 dark:bg-neutral-700 px-1 rounded">docker-compose.yml</code>:
                  </p>
                  <pre className="text-xs bg-neutral-100 dark:bg-neutral-800 rounded p-2 text-neutral-600 dark:text-neutral-300 overflow-x-auto">
{`volumes:
  - /host/path/to/photos:/app/media/Pictures`}
                  </pre>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Then restart the container before adding the folder here.
                  </p>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setAddFolderOpen(false)}
              className="rounded-full dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddFolder}
              className="rounded-full dark:bg-primary-600 dark:hover:bg-primary-700 dark:text-white"
            >
              Add Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Mobile overlay for sidebar */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-10 md:hidden"
          onClick={toggleMobileMenu}
        ></div>
      )}
    </>
  );
}
