import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronRight, Loader2, Images } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Photo } from "@shared/schema";
import { format } from "date-fns";

interface CreateAlbumModalProps {
  onClose: () => void;
  initialTerms?: string[];
}

export function CreateAlbumModal({ onClose }: CreateAlbumModalProps) {
  const [step, setStep] = useState<"name" | "photos">("name");
  const [albumName, setAlbumName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();

  const { data: allPhotos = [], isLoading: photosLoading } = useQuery<Photo[]>({
    queryKey: ["/api/photos"],
  });

  const filtered = search.trim()
    ? allPhotos.filter(p => {
        const q = search.toLowerCase();
        const name = p.fileName.replace(/^import_\d+_\d+_/, "").replace(/_conv\.jpg$/i, "").replace(/_/g, " ").toLowerCase();
        const tags = (p.contentTags ?? []).join(" ").toLowerCase();
        return name.includes(q) || tags.includes(q);
      })
    : allPhotos;

  const toggle = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(p => p.id)));
    }
  };

  const handleNext = () => {
    if (!albumName.trim()) {
      toast({ title: "Name required", description: "Give your memory a name first", variant: "destructive" });
      return;
    }
    setStep("photos");
  };

  const handleCreate = async () => {
    if (selectedIds.size === 0) {
      toast({ title: "No photos selected", description: "Pick at least one photo", variant: "destructive" });
      return;
    }
    setIsCreating(true);
    try {
      const res = await apiRequest("POST", "/api/albums", {
        name: albumName.trim(),
        photoIds: Array.from(selectedIds),
        createdAt: new Date().toISOString(),
      });
      const album = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/albums"] });
      toast({ title: "Memory created", description: `"${albumName}" has been created with ${selectedIds.size} photo${selectedIds.size === 1 ? "" : "s"}` });
      navigate(`/albums/${album.id}`);
      onClose();
    } catch {
      toast({ title: "Error", description: "Failed to create memory. Please try again.", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Images className="h-5 w-5 text-blue-700" />
            {step === "name" ? "New Memory" : `Pick Photos — "${albumName}"`}
          </DialogTitle>
        </DialogHeader>

        {step === "name" ? (
          <div className="flex-1 space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-neutral-700 block mb-1">Memory name</label>
              <Input
                placeholder="e.g., Sofia Bulgaria Walk"
                value={albumName}
                onChange={e => setAlbumName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleNext()}
                autoFocus
                className="text-base"
              />
            </div>
            <p className="text-sm text-neutral-500">Next you'll pick which photos to include.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 gap-3">
            {/* Search + select all */}
            <div className="flex gap-2">
              <Input
                placeholder="Search photos…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={toggleAll} className="shrink-0 text-xs">
                {allSelected ? "Deselect All" : "Select All"}
              </Button>
            </div>

            <p className="text-xs text-neutral-500">
              {selectedIds.size} of {allPhotos.length} selected
            </p>

            {/* Photo grid */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {photosLoading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-neutral-400 py-12 text-sm">No photos found</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {filtered.map(photo => {
                    const selected = selectedIds.has(photo.id);
                    const dateLabel = format(new Date(photo.createdAt), "MMM d, yyyy");
                    return (
                      <div
                        key={photo.id}
                        onClick={() => toggle(photo.id)}
                        className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                          selected ? "border-blue-700 ring-1 ring-blue-700" : "border-transparent hover:border-neutral-300"
                        }`}
                      >
                        <img
                          src={`/api/media/${photo.id}`}
                          alt={photo.fileName}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {selected && (
                          <div className="absolute top-1.5 right-1.5 bg-blue-700 text-white rounded-full p-0.5">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 opacity-0 hover:opacity-100 transition-opacity">
                          <p className="text-white text-[10px] truncate">{dateLabel}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="pt-2">
          {step === "name" ? (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleNext} disabled={!albumName.trim()} className="gap-1">
                Choose Photos <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("name")}>Back</Button>
              <Button onClick={handleCreate} disabled={isCreating || selectedIds.size === 0}>
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {isCreating ? "Creating…" : `Create Memory (${selectedIds.size} photo${selectedIds.size === 1 ? "" : "s"})`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
