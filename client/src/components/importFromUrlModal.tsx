import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2, Image, AlertCircle } from "lucide-react";

interface ImportFromUrlModalProps {
  onClose: () => void;
}

interface ImagePreview {
  id: string;
  thumbnailUrl: string;
  downloadUrl: string;
  name: string;
  selected: boolean;
}

export function ImportFromUrlModal({ onClose }: ImportFromUrlModalProps) {
  const [driveUrl, setDriveUrl] = useState("");
  const [directUrls, setDirectUrls] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [activeTab, setActiveTab] = useState("google-drive");
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const selectedCount = imagePreviews.filter(img => img.selected).length;

  const toggleSelectAll = () => {
    const next = !selectAll;
    setSelectAll(next);
    setImagePreviews(prev => prev.map(img => ({ ...img, selected: next })));
  };

  const toggleImage = (id: string) => {
    const updated = imagePreviews.map(img =>
      img.id === id ? { ...img, selected: !img.selected } : img
    );
    setImagePreviews(updated);
    setSelectAll(updated.every(img => img.selected));
  };

  // --- Google Drive fetch ---
  const handleFetchDrive = async () => {
    if (!driveUrl.trim()) {
      toast({ title: "URL required", description: "Paste a Google Drive folder URL", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setError(null);
    setImagePreviews([]);

    try {
      const res = await apiRequest("POST", "/api/photos/fetch-from-drive", { url: driveUrl.trim() });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to fetch folder");
        return;
      }

      const previews: ImagePreview[] = data.files.map((f: any) => ({
        id: f.id,
        name: f.name,
        thumbnailUrl: f.thumbnailUrl,
        downloadUrl: f.downloadUrl,
        selected: true,
      }));

      setImagePreviews(previews);
      setSelectAll(true);
      toast({ title: "Folder scanned", description: `Found ${previews.length} image${previews.length === 1 ? "" : "s"}` });
    } catch (err) {
      setError("Could not reach Google Drive. Check the URL and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Direct URLs fetch (Dropbox / any public image link) ---
  const handleFetchDirect = () => {
    const lines = directUrls
      .split(/[\n,]+/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length === 0) {
      toast({ title: "No URLs", description: "Enter at least one image URL", variant: "destructive" });
      return;
    }

    // Convert Dropbox share links: dl=0 → dl=1
    const resolved = lines.map(url => {
      if (url.includes("dropbox.com")) return url.replace("?dl=0", "?dl=1").replace("&dl=0", "&dl=1");
      return url;
    });

    const previews: ImagePreview[] = resolved.map((url, i) => ({
      id: `direct-${i}`,
      name: url.split("/").pop()?.split("?")[0] || `photo-${i + 1}.jpg`,
      thumbnailUrl: url,
      downloadUrl: url,
      selected: true,
    }));

    setImagePreviews(previews);
    setSelectAll(true);
    setError(null);
    toast({ title: "Ready to import", description: `${previews.length} URL${previews.length === 1 ? "" : "s"} loaded` });
  };

  // --- Import selected ---
  const handleImport = async () => {
    const selected = imagePreviews.filter(img => img.selected);
    if (selected.length === 0) {
      toast({ title: "Nothing selected", description: "Select at least one image", variant: "destructive" });
      return;
    }

    setIsImporting(true);

    try {
      const res = await apiRequest("POST", "/api/photos/import-from-url", {
        urls: selected.map(img => img.downloadUrl),
        names: selected.map(img => img.name),
      });
      const result = await res.json();
      const successCount = result.results?.filter((r: any) => r.success).length ?? 0;
      const failCount = selected.length - successCount;

      if (successCount > 0) {
        toast({
          title: "Import complete",
          description: `${successCount} photo${successCount === 1 ? "" : "s"} imported${failCount > 0 ? `, ${failCount} failed` : ""}`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
        queryClient.invalidateQueries({ queryKey: ["/api/photos/favorites"] });
        onClose();
      } else {
        toast({
          title: "Import failed",
          description: "None of the images could be downloaded. The folder may not be publicly accessible.",
          variant: "destructive",
        });
      }
    } catch (err) {
      let description = "An error occurred during import.";
      if (err instanceof TypeError) {
        description = "Could not reach the server. Check your connection.";
      } else if (err instanceof Error) {
        try {
          const body = err.message.replace(/^\d+: /, "");
          const parsed = JSON.parse(body);
          if (typeof parsed.message === "string") description = parsed.message;
        } catch {}
      }
      toast({ title: "Import failed", description, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const onTabChange = (tab: string) => {
    setActiveTab(tab);
    setImagePreviews([]);
    setError(null);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Photos from URL</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="google-drive">Google Drive</TabsTrigger>
            <TabsTrigger value="direct">Direct URL</TabsTrigger>
          </TabsList>

          {/* Google Drive tab */}
          <TabsContent value="google-drive" className="space-y-3 pt-4">
            <div className="space-y-1">
              <Label htmlFor="gdrive-url">Google Drive Folder URL</Label>
              <div className="flex gap-2">
                <Input
                  id="gdrive-url"
                  placeholder="https://drive.google.com/drive/folders/..."
                  value={driveUrl}
                  onChange={e => setDriveUrl(e.target.value)}
                  disabled={isLoading}
                  onKeyDown={e => e.key === "Enter" && handleFetchDrive()}
                />
                <Button onClick={handleFetchDrive} disabled={isLoading} className="shrink-0">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The folder must be shared as "Anyone with the link can view"
              </p>
            </div>
          </TabsContent>

          {/* Direct URL tab */}
          <TabsContent value="direct" className="space-y-3 pt-4">
            <div className="space-y-1">
              <Label htmlFor="direct-urls">Image URLs</Label>
              <Textarea
                id="direct-urls"
                placeholder={"https://example.com/photo1.jpg\nhttps://www.dropbox.com/s/.../photo.jpg?dl=0\nhttps://..."}
                value={directUrls}
                onChange={e => setDirectUrls(e.target.value)}
                rows={4}
                className="resize-none text-sm"
              />
              <p className="text-xs text-muted-foreground">
                One URL per line. Dropbox share links are automatically converted to direct downloads.
              </p>
            </div>
            <Button onClick={handleFetchDirect} variant="outline" className="w-full">
              Load URLs
            </Button>
          </TabsContent>
        </Tabs>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Preview grid */}
        {imagePreviews.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox id="select-all" checked={selectAll} onCheckedChange={toggleSelectAll} />
                <Label htmlFor="select-all" className="cursor-pointer text-sm">
                  {selectAll ? "Deselect All" : "Select All"}
                </Label>
              </div>
              <span className="text-sm text-muted-foreground">{selectedCount} of {imagePreviews.length} selected</span>
            </div>

            <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
              {imagePreviews.map(img => (
                <div
                  key={img.id}
                  onClick={() => toggleImage(img.id)}
                  className={`relative aspect-square rounded-md overflow-hidden cursor-pointer border-2 transition-all ${
                    img.selected ? "border-blue-700 ring-1 ring-blue-700" : "border-neutral-200"
                  }`}
                >
                  <img
                    src={img.thumbnailUrl}
                    alt={img.name}
                    className="w-full h-full object-cover bg-neutral-100"
                    onError={e => { (e.target as HTMLImageElement).src = ""; }}
                  />
                  {img.selected && (
                    <div className="absolute top-1 right-1 bg-blue-700 text-white rounded-full p-0.5">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-end p-1">
                    <span className="text-white text-[10px] truncate w-full">{img.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {imagePreviews.length === 0 && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Image className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">Enter a URL above and fetch to preview images</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isImporting}>Cancel</Button>
          {imagePreviews.length > 0 && (
            <Button onClick={handleImport} disabled={isImporting || selectedCount === 0}>
              {isImporting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isImporting ? "Importing…" : `Import ${selectedCount} Photo${selectedCount === 1 ? "" : "s"}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
