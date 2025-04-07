import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Folder } from "@shared/schema";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

export function Sidebar() {
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const [newFolderPath, setNewFolderPath] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  
  // Get folders from API
  const { data: folders = [] } = useQuery<Folder[]>({
    queryKey: ['/api/folders'],
  });
  
  const isActive = (path: string) => {
    return location === path;
  };
  
  const toggleMobileMenu = () => {
    setIsMobileOpen(!isMobileOpen);
  };
  
  const handleAddFolder = async () => {
    if (!newFolderPath || !newFolderName) {
      toast({
        title: "Missing Information",
        description: "Please provide both path and name for the folder",
        variant: "destructive"
      });
      return;
    }
    
    try {
      await apiRequest("POST", "/api/folders", {
        path: newFolderPath,
        name: newFolderName,
        active: true
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/folders'] });
      setAddFolderOpen(false);
      setNewFolderPath("");
      setNewFolderName("");
      
      toast({
        title: "Folder Added",
        description: "The folder has been added successfully"
      });
    } catch (error) {
      console.error("Error adding folder:", error);
      toast({
        title: "Error",
        description: "Failed to add folder. Please check if the path exists and is accessible.",
        variant: "destructive"
      });
    }
  };
  
  return (
    <>
      <div 
        className={`sidebar fixed md:relative w-64 h-full bg-white border-r border-neutral-100 shadow-sm z-20 md:transform-none ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } transition-transform duration-300 ease-in-out`}
      >
        <div className="flex flex-col h-full">
          {/* Logo and App Name */}
          <div className="flex items-center p-4 border-b border-neutral-100">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
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
            <h1 className="ml-3 text-xl font-semibold text-neutral-700">Trace</h1>
          </div>
          
          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto p-2">
            <div className="mb-4">
              <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-3 mb-2">Library</h2>
              <ul>
                <li>
                  <Link href="/">
                    <div className={`sidebar-link flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer ${isActive("/") ? "bg-primary-50 text-primary-500 border-r-3 border-primary-500" : "hover:bg-neutral-50"}`}>
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
                    <div className={`sidebar-link flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer ${isActive("/memories") ? "bg-primary-50 text-primary-500 border-r-3 border-primary-500" : "hover:bg-neutral-50"}`}>
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
                    <div className={`sidebar-link flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer ${isActive("/favorites") ? "bg-primary-50 text-primary-500 border-r-3 border-primary-500" : "hover:bg-neutral-50"}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="text-[20px] mr-3 w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                      </svg>
                      Favorites
                    </div>
                  </Link>
                </li>
              </ul>
            </div>
            
            <div className="mb-4">
              <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-3 mb-2">Categories</h2>
              <ul>
                <li>
                  <Link href="/?category=nature">
                    <div className="sidebar-link flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-neutral-50 cursor-pointer">
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
                    <div className="sidebar-link flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-neutral-50 cursor-pointer">
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
                    <div className="sidebar-link flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-neutral-50 cursor-pointer">
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
                    <div className="sidebar-link flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-neutral-50 cursor-pointer">
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
              <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-3 mb-2">Folders</h2>
              <ul>
                {folders.map(folder => (
                  <li key={folder.id}>
                    <div 
                      onClick={() => {
                        // Start scan for this folder
                        apiRequest("POST", `/api/folders/${folder.id}/scan`);
                        toast({
                          title: "Scanning Started",
                          description: `Scanning folder: ${folder.name}`
                        });
                      }}
                      className="sidebar-link flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-neutral-50 cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="text-[20px] mr-3 w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      </svg>
                      {folder.name}
                    </div>
                  </li>
                ))}
                <li>
                  <button 
                    onClick={() => setAddFolderOpen(true)}
                    className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-primary-500 hover:bg-neutral-50 w-full text-left"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="text-[20px] mr-3 w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Folder
                  </button>
                </li>
              </ul>
            </div>
          </nav>
          
          {/* Settings */}
          <div className="p-3 border-t border-neutral-100">
            <div className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-neutral-50 cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" className="text-[20px] mr-3 w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              Settings
            </div>
          </div>
        </div>
      </div>
      
      {/* Add Folder Dialog */}
      <Dialog open={addFolderOpen} onOpenChange={setAddFolderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label htmlFor="folder-name" className="text-sm font-medium">Folder Name</label>
              <Input
                id="folder-name"
                placeholder="e.g., Photos 2023"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="folder-path" className="text-sm font-medium">Folder Path</label>
              <Input
                id="folder-path"
                placeholder="e.g., C:\Users\Username\Pictures"
                value={newFolderPath}
                onChange={(e) => setNewFolderPath(e.target.value)}
              />
              <p className="text-xs text-neutral-500">Enter the full path to the folder containing your photos</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFolderOpen(false)}>Cancel</Button>
            <Button onClick={handleAddFolder}>Add Folder</Button>
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
