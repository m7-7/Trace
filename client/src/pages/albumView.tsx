import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { PhotoGallery } from "@/components/photoGallery";
import { useQuery } from "@tanstack/react-query";
import { Album } from "@shared/schema";
import { useRoute } from "wouter";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Trash2, ArrowRight, Link, ArrowUpRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useModal } from "@/lib/modalContext";

interface RelatedAlbum {
  id: number;
  name: string;
  coverPhotoId: number | null;
  matchScore: number;
  matchReason: string;
}

export default function AlbumView() {
  const [, params] = useRoute("/albums/:id");
  const albumId = params ? parseInt(params.id) : 0;
  const [, navigate] = useLocation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [relatedAlbums, setRelatedAlbums] = useState<RelatedAlbum[]>([]);
  const { openModal } = useModal();
  
  const { data: album, isLoading } = useQuery<Album>({
    queryKey: [`/api/albums/${albumId}`],
    enabled: !!albumId,
  });
  
  const { data: allAlbums = [] } = useQuery<Album[]>({
    queryKey: ['/api/albums'],
  });
  
  // Calculate related albums based on search terms and date overlap
  useEffect(() => {
    if (!album || !allAlbums.length) return;
    
    const currentAlbumTerms = album.searchTerms || [];
    const currentStartDate = album.dateRangeStart ? new Date(album.dateRangeStart).getTime() : null;
    const currentEndDate = album.dateRangeEnd ? new Date(album.dateRangeEnd).getTime() : null;
    
    // Filter to only get other albums (not current one)
    // Then calculate a match score based on overlapping terms and dates
    const scored = allAlbums
      .filter(a => a.id !== album.id)
      .map(otherAlbum => {
        const otherTerms = otherAlbum.searchTerms || [];
        const otherStartDate = otherAlbum.dateRangeStart ? new Date(otherAlbum.dateRangeStart).getTime() : null;
        const otherEndDate = otherAlbum.dateRangeEnd ? new Date(otherAlbum.dateRangeEnd).getTime() : null;
        
        // Calculate term overlap score (each matching term adds 1)
        const matchingTerms = currentAlbumTerms.filter(term => otherTerms.includes(term));
        const termScore = matchingTerms.length;
        
        // Calculate date overlap (0-1 score)
        let dateScore = 0;
        if (currentStartDate && currentEndDate && otherStartDate && otherEndDate) {
          // Check if date ranges overlap
          if (currentStartDate <= otherEndDate && currentEndDate >= otherStartDate) {
            // Calculate the overlap amount
            const overlapStart = Math.max(currentStartDate, otherStartDate);
            const overlapEnd = Math.min(currentEndDate, otherEndDate);
            const overlapDuration = overlapEnd - overlapStart;
            const currentSpan = currentEndDate - currentStartDate;
            dateScore = Math.min(1, overlapDuration / currentSpan);
          }
        }
        
        // Calculate total score (term matches are weighted more heavily)
        const totalScore = termScore * 2 + dateScore;
        
        // Generate a human-readable reason for the relationship
        let matchReason = "";
        if (matchingTerms.length > 0) {
          matchReason = `Similar content: ${matchingTerms.join(", ")}`;
        } else if (dateScore > 0) {
          matchReason = "Overlapping time period";
        } else {
          matchReason = "You might also enjoy this album";
        }
        
        return {
          ...otherAlbum,
          matchScore: totalScore,
          matchReason
        };
      })
      .filter(album => album.matchScore > 0) // Only keep albums with some match
      .sort((a, b) => b.matchScore - a.matchScore) // Sort by score (highest first)
      .slice(0, 3); // Take top 3 matches
    
    setRelatedAlbums(scored);
  }, [album, allAlbums]);
  
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
      <div className="flex-1 flex flex-col overflow-hidden bg-neutral-50 dark:bg-gray-900">
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
                <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100">{album.name}</h1>
                <div className="flex flex-wrap items-center gap-2 text-neutral-500 dark:text-neutral-400">
                  <span>Created: {formatDate(album.createdAt)}</span>
                  {album.searchTerms && album.searchTerms.length > 0 && (
                    <>
                      <span className="hidden sm:inline">•</span>
                      <div className="flex flex-wrap gap-1">
                        {album.searchTerms.map(term => (
                          <Badge key={term} variant="outline" className="bg-neutral-100 dark:bg-gray-800 dark:text-neutral-200">
                            {term}
                          </Badge>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <Button 
                variant="outline" 
                size="icon"
                className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:border-red-800"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 size={18} />
              </Button>
            </div>
          ) : (
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100">Album Not Found</h1>
              <p className="text-neutral-500 dark:text-neutral-400">This album may have been deleted or doesn't exist</p>
            </div>
          )}
          
          {album && <PhotoGallery albumId={albumId} />}
          
          {/* Related Memories Section */}
          {relatedAlbums.length > 0 && (
            <div className="mt-8 mb-4">
              <h2 className="text-xl font-semibold text-neutral-700 dark:text-neutral-200 mb-4">Related Memories</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {relatedAlbums.map(relatedAlbum => (
                  <Card key={relatedAlbum.id} className="overflow-hidden hover:shadow-md transition-shadow dark:border-gray-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{relatedAlbum.name}</CardTitle>
                      <CardDescription>{relatedAlbum.matchReason}</CardDescription>
                    </CardHeader>
                    <CardFooter className="pt-2 justify-end">
                      <Button 
                        variant="ghost" 
                        className="text-primary-600 dark:text-primary-400" 
                        onClick={() => navigate(`/albums/${relatedAlbum.id}`)}
                      >
                        View Album <ArrowRight size={16} className="ml-1" />
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          )}
          
          {/* Create New Related Memory Button */}
          <div className="mt-8 mb-4 flex justify-center">
            <Button 
              variant="outline" 
              className="border-dashed border-2 h-auto py-6 px-8 dark:border-gray-700 dark:hover:border-gray-600"
              onClick={() => openModal("createAlbum")}
            >
              <div className="flex flex-col items-center">
                <div className="h-12 w-12 rounded-full bg-primary-50 dark:bg-primary-950 flex items-center justify-center mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-500 dark:text-primary-400">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </div>
                <span className="text-lg font-medium">Create New Memory</span>
                <span className="text-sm text-neutral-500 dark:text-neutral-400">Organize more of your precious moments</span>
              </div>
            </Button>
          </div>
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
