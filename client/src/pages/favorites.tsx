import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { PhotoGallery } from "@/components/photoGallery";

export default function Favorites() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-neutral-50">
        <Header />
        
        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-neutral-800">Favorite Photos</h1>
            <p className="text-neutral-500">Your personal collection of favorite memories</p>
          </div>
          
          <PhotoGallery favoritesOnly={true} />
        </main>
      </div>
    </div>
  );
}
