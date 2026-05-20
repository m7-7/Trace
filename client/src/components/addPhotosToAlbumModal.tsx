import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Photo } from "@shared/schema";
import { formatMemoryDate } from "@/lib/utils";

interface AddPhotosToAlbumModalProps {
  albumId: number;
  albumName: string;
  existingPhotoIds: number[];
  onClose: () => void;
}

export function AddPhotosToAlbumModal({ albumId, albumName, existingPhotoIds, onClose }: AddPhotosToAlbumModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");

  const { data: allPhotos = [], isLoading } = useQuery<Photo[]>({
    queryKey: ["/api/photos"],
  });

  const available = allPhotos.filter(p => !existingPhotoIds.includes(p.id));
  const filtered = search.trim()
    ? available.filter(p => {
        const q = search.toLowerCase();
        const name = p.fileName.replace(/^import_\d+_\d+_/, "").replace(/_conv\.jpg$/i, "").replace(/_/g, " ").toLowerCase();
        return name.includes(q) || (p.contentTags ?? []).join(" ").toLowerCase().includes(q);
      })
    : available;

  const toggle = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(selectedIds.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)));
  };

  const handleAdd = async () => {
    if (selectedIds.size === 0) return;
    setIsSaving(true);
    try {
      await apiRequest("POST", `/api/albums/${albumId}/photos`, { photoIds: Array.from(selectedIds) });
      queryClient.invalidateQueries({ queryKey: [`/api/albums/${albumId}/photos`] });
      queryClient.invalidateQueries({ queryKey: ["/api/albums"] });
      toast({ title: "Photos added", description: `Added ${selectedIds.size} photo${selectedIds.size === 1 ? "" : "s"} to "${albumName}"` });
      onClose();
    } catch {
      toast({ title: "Error", description: "Failed to add photos", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Photos to "{albumName}"</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 gap-3">
          <div className="flex gap-2">
            <Input placeholder="Search photos…" value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
            <Button variant="outline" size="sm" onClick={toggleAll} className="shrink-0 text-xs">
              {selectedIds.size === filtered.length && filtered.length > 0 ? "Deselect All" : "Select All"}
            </Button>
          </div>

          <p className="text-xs text-neutral-500">{selectedIds.size} selected · {available.length} available</p>

          <div className="flex-1 overflow-y-auto min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-neutral-400 py-12 text-sm">
                {available.length === 0 ? "All photos are already in this memory" : "No photos match your search"}
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {filtered.map(photo => {
                  const selected = selectedIds.has(photo.id);
                  return (
                    <div
                      key={photo.id}
                      onClick={() => toggle(photo.id)}
                      className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                        selected ? "border-blue-700 ring-1 ring-blue-700" : "border-transparent hover:border-neutral-300"
                      }`}
                    >
                      <img src={`/api/media/${photo.id}`} alt={photo.fileName} className="w-full h-full object-cover" loading="lazy" />
                      {selected && (
                        <div className="absolute top-1.5 right-1.5 bg-blue-700 text-white rounded-full p-0.5">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 opacity-0 hover:opacity-100 transition-opacity">
                        <p className="text-white text-[10px]">{formatMemoryDate(photo)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdd} disabled={isSaving || selectedIds.size === 0}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isSaving ? "Adding…" : `Add ${selectedIds.size} Photo${selectedIds.size === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
