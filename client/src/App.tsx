import { Switch, Route } from "wouter";
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
import { ImportFromUrlModal } from "./components/importFromUrlModal";

// Modal types
export type ModalType = "none" | "scanning" | "createAlbum" | "importFromUrl";

// App context type
interface AppContextInterface {
  openModal: (modal: ModalType) => void;
}

// Create the context with a default value
export const AppContext = createContext<AppContextInterface>({
  openModal: () => {},
});

// Create app component
function App() {
  const [activeModal, setActiveModal] = useState<ModalType>("none");
  
  const openModal = (modal: ModalType) => setActiveModal(modal);
  const closeModal = () => setActiveModal("none");
  
  return (
    <QueryClientProvider client={queryClient}>
      <AppContext.Provider value={{ openModal }}>
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
        <Toaster />
      </AppContext.Provider>
    </QueryClientProvider>
  );
}

export default App;
