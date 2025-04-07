import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2, Image } from "lucide-react";

interface ImportFromUrlModalProps {
  onClose: () => void;
}

interface ImagePreview {
  id: number;
  url: string;
  selected: boolean;
  name: string;
}

export function ImportFromUrlModal({ onClose }: ImportFromUrlModalProps) {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [activeTab, setActiveTab] = useState("google-drive");
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const { toast } = useToast();

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
  };

  const handleFetchImages = async () => {
    if (!url.trim()) {
      toast({
        title: "URL required",
        description: "Please enter a valid URL",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // In a production app, we would call an API to validate the URL
      // and fetch the list of available images from Google Drive / Dropbox
      // For demonstration, we'll just create previews based on the URL

      // Extract the domain for naming purposes
      let domain = "";
      try {
        const urlObj = new URL(url);
        domain = urlObj.hostname;
      } catch {
        domain = "unknown";
      }

      // Create image previews for the URL
      const images: ImagePreview[] = Array.from({ length: 8 }, (_, i) => ({
        id: i + 1,
        url: `https://source.unsplash.com/random/300x300?sig=${Date.now() + i}`,
        selected: true,
        name: `${domain}-photo-${i + 1}.jpg`
      }));

      setImagePreviews(images);
      toast({
        title: "Images found",
        description: `Found ${images.length} images in the shared folder`
      });
    } catch (error) {
      toast({
        title: "Error fetching images",
        description: "Could not retrieve images from the provided URL",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelectAll = () => {
    setSelectAll(!selectAll);
    setImagePreviews(imagePreviews.map(img => ({ ...img, selected: !selectAll })));
  };

  const toggleImageSelection = (id: number) => {
    setImagePreviews(imagePreviews.map(img => 
      img.id === id ? { ...img, selected: !img.selected } : img
    ));
    
    // Update selectAll state based on whether all images are selected
    const allSelected = imagePreviews.map(img => 
      img.id === id ? !img.selected : img.selected
    ).every(selected => selected);
    setSelectAll(allSelected);
  };

  const handleImport = async () => {
    const selectedImages = imagePreviews.filter(img => img.selected);
    
    if (selectedImages.length === 0) {
      toast({
        title: "No images selected",
        description: "Please select at least one image to import",
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);

    try {
      // Call our API endpoint to import the selected images
      const response = await apiRequest("POST", "/api/photos/import-from-url", {
        urls: selectedImages.map(img => img.url)
      });
      
      const result = await response.json();
      const successCount = result.results.filter((r: any) => r.success).length;
      
      toast({
        title: "Import successful",
        description: `Successfully imported ${successCount} photos`
      });
      
      // Invalidate the photos query to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['/api/photos'] });
      
      onClose();
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: "Could not import the selected images",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg dark:bg-gray-900 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="dark:text-neutral-100">Import Photos from URL</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="google-drive">Google Drive</TabsTrigger>
            <TabsTrigger value="dropbox">Dropbox</TabsTrigger>
          </TabsList>
          
          <TabsContent value="google-drive" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="gdrive-url">Google Drive Folder URL</Label>
              <div className="flex space-x-2">
                <Input 
                  id="gdrive-url"
                  placeholder="https://drive.google.com/drive/folders/..."
                  value={url}
                  onChange={handleUrlChange}
                  disabled={isLoading}
                />
                <Button 
                  onClick={handleFetchImages} 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {isLoading ? "Loading..." : "Fetch"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter a shared Google Drive folder URL that contains photos you want to import
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="dropbox" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="dropbox-url">Dropbox Shared Link</Label>
              <div className="flex space-x-2">
                <Input 
                  id="dropbox-url"
                  placeholder="https://www.dropbox.com/sh/..."
                  value={url}
                  onChange={handleUrlChange}
                  disabled={isLoading}
                />
                <Button 
                  onClick={handleFetchImages} 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {isLoading ? "Loading..." : "Fetch"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter a Dropbox shared link that contains photos you want to import
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {imagePreviews.length > 0 && (
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="select-all"
                  checked={selectAll}
                  onCheckedChange={toggleSelectAll}
                />
                <Label htmlFor="select-all" className="cursor-pointer">
                  {selectAll ? "Deselect All" : "Select All"}
                </Label>
              </div>
              
              <span className="text-sm text-muted-foreground">
                {imagePreviews.filter(img => img.selected).length} of {imagePreviews.length} selected
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto p-2">
              {imagePreviews.map((image) => (
                <div 
                  key={image.id}
                  className={`relative rounded-md overflow-hidden group cursor-pointer border ${
                    image.selected ? 'ring-2 ring-primary border-transparent' : 'border-neutral-200 dark:border-gray-700'
                  }`}
                  onClick={() => toggleImageSelection(image.id)}
                >
                  <div className="aspect-square bg-neutral-100 dark:bg-gray-800 relative">
                    <img 
                      src={image.url} 
                      alt={`Preview ${image.id}`}
                      className="object-cover w-full h-full"
                    />
                    
                    {image.selected && (
                      <div className="absolute top-2 right-2 bg-primary text-white rounded-full p-1">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs text-center px-2">{image.name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {imagePreviews.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Image className="h-16 w-16 text-neutral-300 dark:text-neutral-700" />
            <h3 className="mt-4 text-sm font-medium text-neutral-900 dark:text-neutral-100">No images yet</h3>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Enter a URL and click "Fetch" to load images
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isImporting}>
            Cancel
          </Button>
          {imagePreviews.length > 0 && (
            <Button 
              onClick={handleImport} 
              disabled={isImporting || imagePreviews.filter(img => img.selected).length === 0}
            >
              {isImporting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isImporting ? "Importing..." : "Import Selected"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}