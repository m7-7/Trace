import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import React from "react";

// Pages
import Home from "@/pages/home";
import Memories from "@/pages/memories";
import Favorites from "@/pages/favorites";
import AlbumView from "@/pages/albumView";
import NotFound from "@/pages/not-found";
import { ScanningModal } from "./components/scanningModal";
import { CreateAlbumModal } from "./components/createAlbumModal";
import { ImportFromUrlModal } from "./components/importFromUrlModal";

// Import our new modal context
import { ModalProvider, useModal } from "./lib/modalContext";

// Create app component
function AppContent() {
  const { activeModal, closeModal } = useModal();
  
  return (
    <div className="relative">
      {/* Router */}
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/memories" component={Memories} />
        <Route path="/favorites" component={Favorites} />
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
