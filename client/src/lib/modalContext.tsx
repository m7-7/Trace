import React, { createContext, useState, useContext } from 'react';

// Modal types
export type ModalType = "none" | "scanning" | "createAlbum" | "importFromUrl";

// Modal context interface
export interface ModalContextInterface {
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  activeModal: ModalType;
}

// Create context with default values
const ModalContext = createContext<ModalContextInterface>({
  openModal: () => {},
  closeModal: () => {},
  activeModal: "none"
});

// Context provider component
export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [activeModal, setActiveModal] = useState<ModalType>("none");
  
  const openModal = (modal: ModalType) => {
    console.log("Opening modal:", modal);
    setActiveModal(modal);
  };
  
  const closeModal = () => {
    console.log("Closing modal");
    setActiveModal("none");
  };
  
  return (
    <ModalContext.Provider value={{ openModal, closeModal, activeModal }}>
      {children}
    </ModalContext.Provider>
  );
}

// Custom hook to use modal context
export function useModal() {
  return useContext(ModalContext);
}