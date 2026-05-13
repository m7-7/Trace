import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Check, ChevronRight, Loader2, Images, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Photo } from "@shared/schema";
import { format } from "date-fns";

type PlaceResult = { name: string; country: string; lat: number; lng: number };
type RecentPlace = { name: string; lat: number; lng: number };

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
  const [addTagsEnabled, setAddTagsEnabled] = useState(false);
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);
  const [addPlaceEnabled, setAddPlaceEnabled] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const placeDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { data: recentPlaces = [] } = useQuery<RecentPlace[]>({
    queryKey: ["/api/places/recent"],
    enabled: addPlaceEnabled,
    staleTime: 30_000,
  });
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

  const commitTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !pendingTags.includes(tag)) {
      setPendingTags(prev => [...prev, tag]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => setPendingTags(prev => prev.filter(t => t !== tag));

  const runPlaceSearch = async (q: string) => {
    setIsSearchingPlace(true);
    try {
      const res = await apiRequest("GET", `/api/places/search?q=${encodeURIComponent(q)}`);
      setPlaceResults(await res.json() as PlaceResult[]);
    } catch {
      setPlaceResults([]);
    } finally {
      setIsSearchingPlace(false);
    }
  };

  const handlePlaceQueryChange = (value: string) => {
    setPlaceQuery(value);
    setPlaceResults([]);
    setSelectedPlace(null);
    clearTimeout(placeDebounceRef.current);
    if (value.trim().length >= 2) {
      placeDebounceRef.current = setTimeout(() => runPlaceSearch(value.trim()), 400);
    }
  };

  const selectPlace = (result: PlaceResult) => {
    setSelectedPlace(result);
    setPlaceQuery(result.name);
    setPlaceResults([]);
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

      if (addTagsEnabled && pendingTags.length > 0) {
        try {
          await Promise.all(
            Array.from(selectedIds).map(async (photoId) => {
              const photo = allPhotos.find(p => p.id === photoId);
              const existing = photo?.contentTags ?? [];
              const seen = new Set<string>(existing);
              const merged = [...existing];
              for (const t of pendingTags) { if (!seen.has(t)) { seen.add(t); merged.push(t); } }
              if (merged.length > existing.length) {
                await apiRequest("PATCH", `/api/photos/${photoId}/tags`, { tags: merged });
              }
            })
          );
          queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
        } catch {
          // Tags are best-effort; album was already created
        }
      }

      let placeWarning = false;
      if (addPlaceEnabled && selectedPlace) {
        try {
          await Promise.all(
            Array.from(selectedIds).map(photoId =>
              apiRequest("PUT", `/api/photos/${photoId}/location`, {
                coordinates: { lat: selectedPlace.lat, lng: selectedPlace.lng },
                location: selectedPlace.name,
              })
            )
          );
          queryClient.invalidateQueries({ queryKey: ["/api/travel"] });
          queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
          queryClient.invalidateQueries({ queryKey: ["/api/places/recent"] });
        } catch {
          placeWarning = true;
        }
      }

      if (placeWarning) {
        toast({ title: "Memory created", description: "The place couldn't be added to all photos." });
      } else {
        toast({ title: "Memory created", description: `"${albumName}" has been created with ${selectedIds.size} photo${selectedIds.size === 1 ? "" : "s"}` });
      }
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

            {/* Optional batch tagging + place */}
            {selectedIds.size > 0 && (
              <div className="border-t border-neutral-100 pt-3 space-y-2 shrink-0">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="add-tags"
                    checked={addTagsEnabled}
                    onCheckedChange={(v) => setAddTagsEnabled(!!v)}
                  />
                  <Label htmlFor="add-tags" className="text-sm cursor-pointer text-neutral-600">
                    Add tags to selected photos
                  </Label>
                </div>
                {addTagsEnabled && (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap gap-1 items-center">
                      {pendingTags.map(tag => (
                        <span key={tag} className="flex items-center gap-0.5 px-2 py-0.5 bg-neutral-100 rounded-full text-neutral-700 text-xs">
                          {tag}
                          <button onClick={() => removeTag(tag)} className="ml-0.5 text-neutral-400 hover:text-neutral-700 transition-colors">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        ref={tagInputRef}
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") { e.preventDefault(); commitTag(); }
                          if (e.key === "Escape") setTagInput("");
                        }}
                        onBlur={commitTag}
                        placeholder="add tag…"
                        className="px-2 py-0.5 bg-neutral-100 rounded-full text-neutral-700 text-xs outline-none min-w-[80px] placeholder:text-neutral-400"
                      />
                    </div>
                    {pendingTags.length === 0 && (
                      <p className="text-xs text-neutral-400 italic">No tags added — photos will stay untagged.</p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="add-place"
                    checked={addPlaceEnabled}
                    onCheckedChange={(v) => {
                      setAddPlaceEnabled(!!v);
                      if (!v) { setPlaceQuery(""); setPlaceResults([]); setSelectedPlace(null); }
                    }}
                  />
                  <Label htmlFor="add-place" className="text-sm cursor-pointer text-neutral-600">
                    Add a place to this memory
                  </Label>
                </div>
                {addPlaceEnabled && (
                  <div className="space-y-1.5">
                    {recentPlaces.length > 0 && (
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">Recent places</p>
                        <div className="flex flex-wrap gap-1.5">
                          {recentPlaces.map((r) => (
                            <button
                              key={r.name}
                              type="button"
                              onClick={() => selectPlace({ name: r.name, country: "", lat: r.lat, lng: r.lng })}
                              className="px-2.5 py-0.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs rounded-full border border-neutral-200 transition-colors truncate max-w-[160px]"
                            >
                              {r.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="relative">
                      <input
                        value={placeQuery}
                        onChange={e => handlePlaceQueryChange(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Escape") { setPlaceQuery(""); setPlaceResults([]); setSelectedPlace(null); }
                        }}
                        placeholder="Search for a place…"
                        className="w-full px-3 py-1.5 bg-neutral-100 text-neutral-800 text-sm rounded-md outline-none placeholder:text-neutral-400 border border-neutral-200 focus:border-neutral-400"
                      />
                      {isSearchingPlace && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">…</span>
                      )}
                    </div>
                    {placeResults.length > 0 && (
                      <div className="rounded-md border border-neutral-200 bg-white overflow-hidden shadow-sm">
                        {placeResults.map((r, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => selectPlace(r)}
                            className="w-full text-left px-3 py-2 hover:bg-neutral-50 transition-colors border-t border-neutral-100 first:border-t-0"
                          >
                            <span className="text-neutral-800 text-sm block truncate">{r.name}</span>
                            {r.country && <span className="text-neutral-400 text-xs">{r.country}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedPlace ? (
                      <p className="text-xs text-neutral-500">
                        <span className="text-neutral-700 font-medium">{selectedPlace.name}</span>
                        {selectedPlace.country ? `, ${selectedPlace.country}` : ""}{" "}
                        will be added to {selectedIds.size} photo{selectedIds.size === 1 ? "" : "s"}.
                      </p>
                    ) : (
                      <p className="text-xs text-neutral-400 italic">No place selected yet.</p>
                    )}
                  </div>
                )}
              </div>
            )}
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
