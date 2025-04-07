import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface CreateAlbumModalProps {
  onClose: () => void;
  initialTerms?: string[];
}

export function CreateAlbumModal({ onClose, initialTerms = [] }: CreateAlbumModalProps) {
  const [albumName, setAlbumName] = useState("");
  const [searchTerms, setSearchTerms] = useState<string[]>(initialTerms);
  const [newTerm, setNewTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [, navigate] = useLocation();
  
  const handleAddTerm = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && newTerm.trim()) {
      e.preventDefault();
      if (!searchTerms.includes(newTerm.trim())) {
        setSearchTerms([...searchTerms, newTerm.trim()]);
      }
      setNewTerm("");
    }
  };
  
  const handleRemoveTerm = (term: string) => {
    setSearchTerms(searchTerms.filter(t => t !== term));
  };
  
  const handleCreateAlbum = async () => {
    if (!albumName.trim()) {
      toast({
        title: "Album name required",
        description: "Please provide a name for your album",
        variant: "destructive"
      });
      return;
    }
    
    if (searchTerms.length === 0) {
      toast({
        title: "Search terms required",
        description: "Please add at least one search term",
        variant: "destructive"
      });
      return;
    }
    
    setIsCreating(true);
    
    try {
      const albumData = {
        name: albumName,
        searchTerms,
        dateRangeStart: startDate ? new Date(startDate).toISOString() : null,
        dateRangeEnd: endDate ? new Date(endDate).toISOString() : null,
        createdAt: new Date().toISOString(),
      };
      
      const result = await apiRequest("POST", "/api/albums", albumData);
      const newAlbum = await result.json();
      
      queryClient.invalidateQueries({ queryKey: ['/api/albums'] });
      
      toast({
        title: "Album Created",
        description: `"${albumName}" has been created with ${newAlbum.photoCount || 0} photos`
      });
      
      // Navigate to the new album
      navigate(`/albums/${newAlbum.id}`);
      onClose();
    } catch (error) {
      console.error("Error creating album:", error);
      toast({
        title: "Error",
        description: "Failed to create album. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Memory Album</DialogTitle>
        </DialogHeader>
        
        <div className="mb-4">
          <label htmlFor="album-name" className="block text-sm font-medium text-neutral-700 mb-1">Album Name</label>
          <Input
            id="album-name"
            className="w-full"
            placeholder="e.g., Winter Morning Coffee"
            value={albumName}
            onChange={(e) => setAlbumName(e.target.value)}
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-700 mb-1">Search Terms</label>
          <div className="flex flex-wrap gap-2 p-2 border border-neutral-200 rounded-lg mb-2 bg-neutral-50 min-h-[60px]">
            {searchTerms.map(term => (
              <Badge key={term} variant="secondary" className="bg-primary-100 text-primary-700 hover:bg-primary-200">
                {term}
                <button
                  onClick={() => handleRemoveTerm(term)}
                  className="ml-1 text-primary-500 hover:text-primary-700"
                >
                  <X size={14} />
                </button>
              </Badge>
            ))}
            <Input
              className="flex-grow min-w-[100px] bg-transparent border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 p-1 h-7"
              placeholder="Add more terms..."
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              onKeyDown={handleAddTerm}
            />
          </div>
          <p className="text-xs text-neutral-500">Add terms to filter your photos by content, time, or location</p>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-700 mb-1">Date Range (Optional)</label>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreateAlbum} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Album"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
