import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { PhotoGallery } from "@/components/photoGallery";
import { useQuery } from "@tanstack/react-query";
import { Album } from "@shared/schema";
import { useRoute } from "wouter";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useState } from "react";

export default function AlbumView() {
  const [, params] = useRoute("/albums/:id");
  const albumId = params ? parseInt(params.id) : 0;
  const [, navigate] = useLocation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const { data: album, isLoading } = useQuery<Album>({
    queryKey: [`/api/albums/${albumId}`],
    enabled: !!albumId,
  });
  
  const formatDate = (date: Date | null) => {
    if (!date) return "No date";
    return format(new Date(date), "MMMM d, yyyy");
  };
  
  const handleDeleteAlbum = async () => {
    try {
      await apiRequest("DELETE", `/api/albums/${albumId}`, null);
      queryClient.invalidateQueries({ queryKey: ['/api/albums'] });
      
      toast({
        title: "Album Deleted",
        description: "The album has been successfully deleted"
      });
      
      navigate("/memories");
    } catch (error) {
      console.error("Error deleting album:", error);
      toast({
        title: "Error",
        description: "Failed to delete album",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-neutral-50">
        <Header />
        
        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {isLoading ? (
            <div className="mb-6">
              <Skeleton className="h-8 w-64 mb-1" />
              <Skeleton className="h-4 w-48" />
            </div>
          ) : album ? (
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-neutral-800">{album.name}</h1>
                <div className="flex items-center space-x-2 text-neutral-500">
                  <span>Created: {formatDate(album.createdAt)}</span>
                  {album.searchTerms && album.searchTerms.length > 0 && (
                    <>
                      <span>•</span>
                      <span>
                        Terms: {album.searchTerms.join(", ")}
                      </span>
                    </>
                  )}
                </div>
              </div>
              
              <Button 
                variant="outline" 
                size="icon"
                className="text-red-500 hover:bg-red-50 hover:text-red-600"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 size={18} />
              </Button>
            </div>
          ) : (
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-neutral-800">Album Not Found</h1>
              <p className="text-neutral-500">This album may have been deleted or doesn't exist</p>
            </div>
          )}
          
          {album && <PhotoGallery albumId={albumId} />}
        </main>
      </div>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Album</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this album? This action cannot be undone.
              The photos in this album will not be deleted, only the album itself.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAlbum} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
