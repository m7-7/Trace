import { Switch, Route } from "wouter";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient, getQueryFn } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import React, { useState, useEffect } from "react";

// Pages
import Home from "@/pages/home";
import Memories from "@/pages/memories";
import Favorites from "@/pages/favorites";
import TravelYourWorld from "@/pages/travelYourWorld";
import AlbumView from "@/pages/albumView";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Setup from "@/pages/setup";
import { ScanningModal } from "./components/scanningModal";
import { CreateAlbumModal } from "./components/createAlbumModal";
import { ImportFromUrlModal } from "./components/importFromUrlModal";
import { UploadProgressBar } from "./components/uploadProgressBar";

// Import our new modal context
import { ModalProvider, useModal } from "./lib/modalContext";

// Create app component
function AppContent() {
  const { data: auth, isLoading: authLoading } = useQuery<{
    authenticated?: boolean;
    needsSetup?: boolean;
  } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { activeModal, closeModal } = useModal();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string | undefined>(undefined);
  
  // Listen for upload events
  useEffect(() => {
    // For demonstration purposes, simulate a file upload when scanning modal opens
    if (activeModal === 'scanning') {
      let progress = 0;
      setIsUploading(true);
      setUploadFileName('Processing photos...');
      
      const interval = setInterval(() => {
        progress += Math.random() * 5;
        if (progress >= 100) {
          progress = 100;
          setUploadProgress(100);
          setTimeout(() => {
            setIsUploading(false);
            clearInterval(interval);
          }, 1000);
        } else {
          setUploadProgress(progress);
        }
      }, 200);
      
      return () => clearInterval(interval);
    } else {
      setIsUploading(false);
    }
  }, [activeModal]);
  
  if (authLoading) return <div className="min-h-screen bg-gray-900" />;
  if (auth?.needsSetup) return <Setup />;
  if (!auth) return <Login />;

  return (
    <div className="relative min-h-screen dark:bg-gray-900 dark:text-white">
      {/* Top Upload Progress Bar */}
      <UploadProgressBar 
        isUploading={isUploading} 
        progress={uploadProgress} 
        fileName={uploadFileName}
        onClose={() => setIsUploading(false)}
      />
      
      {/* Router */}
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/memories" component={Memories} />
        <Route path="/favorites" component={Favorites} />
        <Route path="/travel" component={TravelYourWorld} />
        <Route path="/albums/:id" component={AlbumView} />
        <Route component={NotFound} />
      </Switch>
      
      {/* Modals */}
      {activeModal === "scanning" && (
        <ScanningModal onClose={closeModal} />
      )}
      
      {activeModal === "createAlbum" && (
        <CreateAlbumModal onClose={closeModal} />
      )}
      
      {activeModal === "importFromUrl" && (
        <ImportFromUrlModal onClose={closeModal} />
      )}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ModalProvider>
        <AppContent />
        <Toaster />
      </ModalProvider>
    </QueryClientProvider>
  );
}

export default App;
