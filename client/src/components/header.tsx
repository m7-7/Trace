import { useState } from "react";
import { useModal } from "@/lib/modalContext";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";

export function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, navigate] = useLocation();
  const { openModal } = useModal();
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery.trim())}`);
      
      // If this contains keywords like "winter", "coffee", etc., offer to create an album
      const commonTerms = ["winter", "summer", "beach", "coffee", "sunset", "morning", "night"];
      if (commonTerms.some(term => searchQuery.toLowerCase().includes(term))) {
        openModal("createAlbum");
      }
    }
  };
  
  return (
    <header className="bg-white dark:bg-gray-900 border-b border-neutral-100 dark:border-gray-800 shadow-sm z-10">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Mobile menu button */}
        <button 
          className="md:hidden rounded-md p-2 text-neutral-400 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-gray-800"
          onClick={() => {
            const sidebar = document.querySelector('.sidebar');
            sidebar?.classList.toggle('transform-none');
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        
        {/* Search Bar */}
        <div className="flex-1 max-w-2xl mx-4">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-neutral-400 dark:text-neutral-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </span>
              <Input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-neutral-200 dark:border-gray-700 rounded-lg bg-neutral-50 dark:bg-gray-800 dark:text-neutral-200 focus:bg-white dark:focus:bg-gray-700"
                placeholder="Search photos (e.g., 'winter morning coffee')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </form>
        </div>
        
        {/* Header Actions */}
        <div className="flex items-center space-x-2">
          <button 
            className="p-2 rounded-full hover:bg-neutral-50 dark:hover:bg-gray-800 dark:text-neutral-200" 
            title="Scan for new photos"
            onClick={() => openModal("scanning")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
              <line x1="16" y1="5" x2="16" y2="10"></line>
              <line x1="21" y1="10" x2="16" y2="10"></line>
            </svg>
          </button>
          <button className="p-2 rounded-full hover:bg-neutral-50 dark:hover:bg-gray-800 dark:text-neutral-200" title="User profile">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
