import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import React, { useState, createContext } from "react";

// Pages
import Home from "@/pages/home";
import Memories from "@/pages/memories";
import Favorites from "@/pages/favorites";
import AlbumView from "@/pages/albumView";
import NotFound from "@/pages/not-found";
import { ScanningModal } from "./components/scanningModal";
import { CreateAlbumModal } from "./components/createAlbumModal";

export type ModalTypes = "none" | "scanning" | "createAlbum";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/memories" component={Memories} />
      <Route path="/favorites" component={Favorites} />
      <Route path="/albums/:id" component={AlbumView} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [activeModal, setActiveModal] = useState<ModalTypes>("none");
  
  const openModal = (modalType: ModalTypes) => setActiveModal(modalType);
  const closeModal = () => setActiveModal("none");
  
  return (
    <QueryClientProvider client={queryClient}>
      <div className="relative">
        <Router />
        
        {/* Modals */}
        {activeModal === "scanning" && (
          <ScanningModal onClose={closeModal} />
        )}
        
        {activeModal === "createAlbum" && (
          <CreateAlbumModal onClose={closeModal} />
        )}
        
        {/* Context provider for modal control */}
        <AppContext.Provider value={{ openModal }}>
          <Router />
        </AppContext.Provider>
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

// Context for globally accessible functions
type AppContextType = {
  openModal: (modalType: ModalTypes) => void;
};

export const AppContext = createContext<AppContextType>({
  openModal: () => {},
});

export default App;
