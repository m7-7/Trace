import { Photo } from "@shared/schema";
import { useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import { X, ChevronLeft, ChevronRight, Star, Calendar, HardDrive, Tag, RotateCw, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "@/lib/leafletConfig";

type Coords = { lat: number; lng: number };

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
      map.flyTo(e.latlng, Math.max(map.getZoom(), 6), { duration: 0.5 });
    },
  });
  return null;
}

type PlaceResult = { name: string; country: string; lat: number; lng: number };

interface PhotoModalProps {
  photo: Photo;
  allPhotos?: Photo[];
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
}

export function PhotoModal({ photo, allPhotos, onClose, isFavorite, onToggleFavorite }: PhotoModalProps) {
  const photos = allPhotos ?? [photo];
  const [currentIndex, setCurrentIndex] = useState(() => Math.max(0, photos.findIndex(p => p.id === photo.id)));
  const current = photos[currentIndex] ?? photo;
  const [imageLoaded, setImageLoaded] = useState(false);
  const prevIndexRef = useRef(currentIndex);

  const filterTags = (tags: string[] | null | undefined) =>
    (tags ?? []).filter((t) => !t.startsWith("from:") && !t.startsWith("error_") && t !== "imported");

  const [localTags, setLocalTags] = useState<string[]>(() => filterTags(photo.contentTags));
  const [addingTag, setAddingTag] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  const [localRotation, setLocalRotation] = useState<number>(current.rotation ?? 0);

  const [localCoords, setLocalCoords] = useState<Coords | null>(current.coordinates as Coords | null);
  const [localLocationName, setLocalLocationName] = useState<string>(current.location ?? "");
  const [placingMode, setPlacingMode] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<Coords | null>(null);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const placingModeRef = useRef(false);
  placingModeRef.current = placingMode;

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setLocalTags(filterTags(current.contentTags));
    setLocalRotation(current.rotation ?? 0);
    setAddingTag(false);
    setTagInput("");
    setLocalCoords(current.coordinates as Coords | null);
    setLocalLocationName(current.location ?? "");
    setPlacingMode(false);
    setPendingCoords(null);
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
  }, [current.id]);

  useEffect(() => {
    if (addingTag) tagInputRef.current?.focus();
  }, [addingTag]);

  const patchTags = async (newTags: string[], prev: string[]) => {
    setLocalTags(newTags);
    try {
      await apiRequest("PATCH", `/api/photos/${current.id}/tags`, { tags: newTags });
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/photos/favorites"] });
    } catch {
      setLocalTags(prev);
    }
  };

  const addTag = (value: string) => {
    const tag = value.trim().toLowerCase();
    if (!tag || localTags.includes(tag)) return;
    patchTags([...localTags, tag], localTags);
  };

  const removeTag = (tag: string) => {
    patchTags(localTags.filter((t) => t !== tag), localTags);
  };

  const commitTagInput = () => {
    addTag(tagInput);
    setTagInput("");
    setAddingTag(false);
  };

  const handleRotate = async () => {
    const next = ((localRotation + 90) % 360) as 0 | 90 | 180 | 270;
    setLocalRotation(next);
    try {
      await apiRequest("PATCH", `/api/photos/${current.id}/rotation`, { rotation: next });
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/photos/favorites"] });
    } catch {
      setLocalRotation(localRotation);
    }
  };

  const openPlacingMode = () => {
    setPendingCoords(null);
    setSearchQuery("");
    setSearchResults([]);
    setPlacingMode(true);
  };

  const confirmManualTap = async () => {
    if (!pendingCoords || isSavingLocation) return;
    setIsSavingLocation(true);
    try {
      await apiRequest("PUT", `/api/photos/${current.id}/location`, {
        coordinates: pendingCoords,
        location: null,
      });
      setLocalCoords(pendingCoords);
      setLocalLocationName("");
      setPlacingMode(false);
      setPendingCoords(null);
      queryClient.invalidateQueries({ queryKey: ["/api/travel"] });
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
    } catch {
      // keep state, let user retry
    } finally {
      setIsSavingLocation(false);
    }
  };

  const removeLocation = async () => {
    if (isSavingLocation) return;
    setIsSavingLocation(true);
    try {
      await apiRequest("PUT", `/api/photos/${current.id}/location`, {
        coordinates: null,
        location: null,
      });
      setLocalCoords(null);
      setLocalLocationName("");
      setPlacingMode(false);
      setPendingCoords(null);
      queryClient.invalidateQueries({ queryKey: ["/api/travel"] });
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
    } catch {
      //
    } finally {
      setIsSavingLocation(false);
    }
  };

  const runSearch = async (q: string) => {
    setIsSearching(true);
    try {
      const res = await apiRequest("GET", `/api/places/search?q=${encodeURIComponent(q)}`);
      setSearchResults(await res.json() as PlaceResult[]);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSearchResults([]);
    clearTimeout(searchDebounceRef.current);
    if (value.trim().length >= 2) {
      searchDebounceRef.current = setTimeout(() => runSearch(value.trim()), 400);
    }
  };

  const selectResult = async (result: PlaceResult) => {
    setSearchResults([]);
    setSearchQuery("");
    setIsSavingLocation(true);
    try {
      await apiRequest("PUT", `/api/photos/${current.id}/location`, {
        coordinates: { lat: result.lat, lng: result.lng },
        location: result.name,
      });
      setLocalCoords({ lat: result.lat, lng: result.lng });
      setLocalLocationName(result.name);
      setPlacingMode(false);
      queryClient.invalidateQueries({ queryKey: ["/api/travel"] });
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
    } catch {
      // keep placing mode open for retry
    } finally {
      setIsSavingLocation(false);
    }
  };

  useEffect(() => {
    if (prevIndexRef.current !== currentIndex) {
      setImageLoaded(false);
      prevIndexRef.current = currentIndex;
    }
  }, [currentIndex]);

  const goNext = useCallback(() => setCurrentIndex(i => Math.min(i + 1, photos.length - 1)), [photos.length]);
  const goPrev = useCallback(() => setCurrentIndex(i => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (placingModeRef.current) {
          setPlacingMode(false);
          setPendingCoords(null);
          setSearchQuery("");
          setSearchResults([]);
          return;
        }
        onClose();
        return;
      }
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goNext, goPrev]);

  const displayName = (current.fileName
    .replace(/_conv\.jpg$/i, "")
    .replace(/^import_\d+_\d+_/, "")
    .replace(/\.[^.]+$/i, "")
    .replace(/_/g, " ")
    .trim()) || current.fileName;

  const dateLabel = format(new Date(current.createdAt), "MMMM d, yyyy");
  const fileSizeLabel = current.fileSize
    ? current.fileSize >= 1024 * 1024 * 1024
      ? `${(current.fileSize / 1024 / 1024 / 1024).toFixed(2)} GB`
      : current.fileSize >= 1024 * 1024
      ? `${(current.fileSize / 1024 / 1024).toFixed(1)} MB`
      : `${(current.fileSize / 1024).toFixed(0)} KB`
    : null;


  const mapInitCenter: [number, number] = localCoords ? [localCoords.lat, localCoords.lng] : [20, 0];
  const mapInitZoom = localCoords ? 5 : 2;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal container */}
      <div
        className="relative flex w-full max-w-5xl max-h-[90vh] mx-4 rounded-2xl overflow-hidden bg-neutral-900 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Image pane */}
        <div className="relative flex-1 flex items-center justify-center bg-black min-w-0">
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-neutral-700 border-t-neutral-300 animate-spin" />
            </div>
          )}
          <img
            key={current.id}
            src={`/api/media/${current.id}`}
            alt={displayName}
            className={`max-h-[90vh] max-w-full object-contain transition-opacity duration-200 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            style={{ transform: `rotate(${localRotation}deg)` }}
            onLoad={() => setImageLoaded(true)}
          />

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Prev / Next arrows */}
          {currentIndex > 0 && (
            <button
              onClick={goPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {currentIndex < photos.length - 1 && (
            <button
              onClick={goNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}

          {/* Counter */}
          {photos.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 text-white text-xs">
              {currentIndex + 1} / {photos.length}
            </div>
          )}
        </div>

        {/* Info sidebar */}
        <div className="w-64 shrink-0 flex flex-col bg-neutral-900 border-l border-neutral-800 p-5 overflow-y-auto">
          {/* Name + favorite */}
          <div className="flex items-start justify-between gap-2 mb-4">
            <h2 className="text-white font-semibold text-sm leading-snug capitalize flex-1">{displayName}</h2>
            <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
              <button onClick={handleRotate} title="Rotate 90° clockwise">
                <RotateCw className="h-4 w-4 text-neutral-500 hover:text-white transition-colors" />
              </button>
              <button onClick={onToggleFavorite}>
                <Star
                  className={`h-5 w-5 transition-colors ${isFavorite ? "text-yellow-400 fill-yellow-400" : "text-neutral-500 hover:text-yellow-400"}`}
                />
              </button>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            {/* Date */}
            <div className="flex items-start gap-2.5">
              <Calendar className="h-4 w-4 text-neutral-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-neutral-400 text-xs mb-0.5">Date taken</p>
                <p className="text-white">{dateLabel}</p>
              </div>
            </div>

            {/* File size */}
            {fileSizeLabel && (
              <div className="flex items-start gap-2.5">
                <HardDrive className="h-4 w-4 text-neutral-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-neutral-400 text-xs mb-0.5">File size</p>
                  <p className="text-white">{fileSizeLabel}</p>
                </div>
              </div>
            )}

            {/* Tags */}
            <div className="flex items-start gap-2.5">
              <Tag className="h-4 w-4 text-neutral-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-neutral-400 text-xs">Tags</p>
                  {!addingTag && (
                    <button
                      onClick={() => setAddingTag(true)}
                      className="text-xs text-neutral-400 hover:text-white transition-colors"
                    >
                      + Add tag
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {localTags.map((tag) => (
                    <span key={tag} className="group/tag flex items-center gap-0.5 px-2 py-0.5 bg-neutral-800 rounded-full text-neutral-300 text-xs capitalize">
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="opacity-0 group-hover/tag:opacity-100 transition-opacity ml-0.5"
                        title={`Remove ${tag}`}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                  {localTags.length === 0 && !addingTag && (
                    <button
                      onClick={() => setAddingTag(true)}
                      className="text-neutral-600 hover:text-neutral-400 text-xs italic transition-colors"
                    >
                      No tags yet
                    </button>
                  )}
                  {addingTag && (
                    <input
                      ref={tagInputRef}
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); commitTagInput(); }
                        if (e.key === "Escape") { setTagInput(""); setAddingTag(false); }
                      }}
                      onBlur={commitTagInput}
                      placeholder="add tag…"
                      className="px-2 py-0.5 bg-neutral-700 rounded-full text-neutral-300 text-xs outline-none w-20 placeholder:text-neutral-500"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Place Memory */}
            <div className="flex items-start gap-2.5">
              <MapPin className="h-4 w-4 text-neutral-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-neutral-400 text-xs">Place</p>
                  {!placingMode && (
                    <button
                      onClick={openPlacingMode}
                      className="text-xs text-neutral-400 hover:text-white transition-colors"
                    >
                      {localCoords ? "Edit" : "+ Place on map"}
                    </button>
                  )}
                </div>

                {!placingMode && (
                  localCoords ? (
                    <p className="text-white text-xs">
                      {localLocationName || `${localCoords.lat.toFixed(2)}°, ${localCoords.lng.toFixed(2)}°`}
                    </p>
                  ) : (
                    <button
                      onClick={openPlacingMode}
                      className="text-neutral-600 hover:text-neutral-400 text-xs italic transition-colors"
                    >
                      Not placed yet
                    </button>
                  )
                )}

                {placingMode && (
                  <div className="space-y-2">
                    {/* Search input */}
                    <div className="relative">
                      <input
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") { e.preventDefault(); setSearchQuery(""); setSearchResults([]); }
                        }}
                        placeholder="Search for a place…"
                        className="w-full px-2 py-1 bg-neutral-800 text-neutral-200 text-xs rounded outline-none placeholder:text-neutral-600 border border-neutral-700 focus:border-neutral-500"
                      />
                      {isSearching && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 text-xs">…</span>
                      )}
                    </div>

                    {/* Search results */}
                    {searchResults.length > 0 && (
                      <div className="rounded border border-neutral-700 bg-neutral-800 overflow-hidden">
                        <p className="px-2 pt-1.5 pb-0.5 text-neutral-500 text-xs">Choose a place</p>
                        {searchResults.map((r, i) => (
                          <button
                            key={i}
                            onClick={() => selectResult(r)}
                            disabled={isSavingLocation}
                            className="w-full text-left px-2 py-1.5 hover:bg-neutral-700 transition-colors border-t border-neutral-700/50 disabled:opacity-40"
                          >
                            <span className="text-neutral-200 text-xs block truncate">{r.name}</span>
                            {r.country && <span className="text-neutral-500 text-xs">{r.country}</span>}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Map */}
                    <div className="rounded overflow-hidden" style={{ height: "180px" }}>
                      <MapContainer
                        center={mapInitCenter}
                        zoom={mapInitZoom}
                        scrollWheelZoom={true}
                        style={{ height: "100%", width: "100%" }}
                      >
                        <MapResizeFix />
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapClickHandler onPick={(lat, lng) => setPendingCoords({ lat, lng })} />
                        {pendingCoords && (
                          <Marker position={[pendingCoords.lat, pendingCoords.lng]} />
                        )}
                      </MapContainer>
                    </div>
                    <p className="text-neutral-600 text-xs">or tap anywhere to place approximately</p>

                    {pendingCoords && (
                      <button
                        onClick={confirmManualTap}
                        disabled={isSavingLocation}
                        className="w-full px-2 py-1 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
                      >
                        {isSavingLocation ? "Saving…" : "Confirm approximate place"}
                      </button>
                    )}

                    <button
                      onClick={() => { setPlacingMode(false); setPendingCoords(null); setSearchQuery(""); setSearchResults([]); }}
                      className="w-full px-2 py-1 text-neutral-400 hover:text-white text-xs transition-colors"
                    >
                      Cancel
                    </button>
                    {localCoords && (
                      <button
                        onClick={removeLocation}
                        disabled={isSavingLocation}
                        className="text-neutral-600 hover:text-red-400 text-xs transition-colors disabled:opacity-40"
                      >
                        Remove placement
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {current.description && !current.description.startsWith("Imported from") && (
            <p className="mt-4 pt-4 border-t border-neutral-800 text-neutral-400 text-xs leading-relaxed">
              {current.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
