import { useEffect, useState, useRef } from "react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "@/lib/leafletConfig";
import { useQuery } from "@tanstack/react-query";
import { Photo } from "@shared/schema";
import { PhotoCard } from "@/components/photoCard";
import { X, Check, Pencil, Tag } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

type PlaceResult = { name: string; country: string; lat: number; lng: number };
type RecentPlace = { name: string; lat: number; lng: number };
type PendingPlace = { name: string; lat: number; lng: number };

interface TravelData {
  placed: Photo[];
  unplaced: Photo[];
}

interface Cluster {
  key: string;
  lat: number;
  lng: number;
  label: string;
  photos: Photo[];
}

// Group photos by ~11 km grid cells (1 decimal place)
function clusterPhotos(photos: Photo[]): Cluster[] {
  const map = new Map<string, Photo[]>();

  for (const photo of photos) {
    const coords = photo.coordinates as { lat: number; lng: number } | null;
    if (!coords) continue;
    const key = `${Math.round(coords.lat * 10) / 10},${Math.round(coords.lng * 10) / 10}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(photo);
  }

  return Array.from(map.entries()).map(([key, clusterPhotos]) => {
    const [latStr, lngStr] = key.split(",");
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    // Use the most common non-empty location name in the cluster, or formatted coords
    const names = clusterPhotos.map(p => p.location).filter(Boolean) as string[];
    const label = names.length > 0
      ? names.sort((a, b) =>
          names.filter(n => n === b).length - names.filter(n => n === a).length
        )[0]
      : `${lat.toFixed(1)}°, ${lng.toFixed(1)}°`;

    return { key, lat, lng, label, photos: clusterPhotos };
  });
}

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

export default function TravelYourWorld() {
  const { data, isLoading } = useQuery<TravelData>({
    queryKey: ["/api/travel"],
  });

  const placed = data?.placed ?? [];
  const unplaced = data?.unplaced ?? [];
  const unplacedCount = unplaced.length;
  const clusters = clusterPhotos(placed);

  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedUnplaced, setSelectedUnplaced] = useState<Set<number>>(new Set());
  const [batchPlaceQuery, setBatchPlaceQuery] = useState("");
  const [batchPlaceResults, setBatchPlaceResults] = useState<PlaceResult[]>([]);
  const [isBatchSearching, setIsBatchSearching] = useState(false);
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const batchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [pendingBatchPlace, setPendingBatchPlace] = useState<PendingPlace | null>(null);
  const [pendingClusterPlace, setPendingClusterPlace] = useState<PendingPlace | null>(null);

  const [editingClusterPlace, setEditingClusterPlace] = useState(false);
  const [clusterPlaceQuery, setClusterPlaceQuery] = useState("");
  const [clusterPlaceResults, setClusterPlaceResults] = useState<PlaceResult[]>([]);
  const [isClusterSearching, setIsClusterSearching] = useState(false);
  const [isClusterSaving, setIsClusterSaving] = useState(false);
  const clusterDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [editingClusterLabel, setEditingClusterLabel] = useState(false);
  const [clusterLabelInput, setClusterLabelInput] = useState("");
  const [isSavingLabel, setIsSavingLabel] = useState(false);

  const { data: recentPlaces = [] } = useQuery<RecentPlace[]>({
    queryKey: ["/api/places/recent"],
    enabled: selectMode || editingClusterPlace,
    staleTime: 30_000,
  });

  const toggleSelectUnplaced = (id: number) => {
    setSelectedUnplaced(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const cancelSelectMode = () => {
    clearTimeout(batchDebounceRef.current);
    setSelectMode(false);
    setSelectedUnplaced(new Set());
    setBatchPlaceQuery("");
    setBatchPlaceResults([]);
    setIsBatchSearching(false);
    setPendingBatchPlace(null);
  };

  const runBatchSearch = async (q: string) => {
    setIsBatchSearching(true);
    try {
      const res = await apiRequest("GET", `/api/places/search?q=${encodeURIComponent(q)}`);
      setBatchPlaceResults(await res.json() as PlaceResult[]);
    } catch {
      setBatchPlaceResults([]);
    } finally {
      setIsBatchSearching(false);
    }
  };

  const handleBatchQueryChange = (value: string) => {
    setBatchPlaceQuery(value);
    setBatchPlaceResults([]);
    clearTimeout(batchDebounceRef.current);
    if (value.trim().length >= 2) {
      batchDebounceRef.current = setTimeout(() => runBatchSearch(value.trim()), 400);
    }
  };

  const applyBatchPlace = async (place: { name: string; lat: number; lng: number }) => {
    if (isBatchSaving || selectedUnplaced.size === 0) return;
    setIsBatchSaving(true);
    try {
      await Promise.all(
        Array.from(selectedUnplaced).map(photoId =>
          apiRequest("PUT", `/api/photos/${photoId}/location`, {
            coordinates: { lat: place.lat, lng: place.lng },
            location: place.name,
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ["/api/travel"] });
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/places/recent"] });
      cancelSelectMode();
    } catch {
      toast({ title: "Couldn't add place", description: "Some photos may not have been updated. Please try again.", variant: "destructive" });
    } finally {
      setIsBatchSaving(false);
    }
  };

  const closeClusterOverlay = () => {
    clearTimeout(clusterDebounceRef.current);
    setSelectedCluster(null);
    setEditingClusterPlace(false);
    setClusterPlaceQuery("");
    setClusterPlaceResults([]);
    setIsClusterSearching(false);
    setPendingClusterPlace(null);
    setEditingClusterLabel(false);
    setClusterLabelInput("");
  };

  const runClusterSearch = async (q: string) => {
    setIsClusterSearching(true);
    try {
      const res = await apiRequest("GET", `/api/places/search?q=${encodeURIComponent(q)}`);
      setClusterPlaceResults(await res.json() as PlaceResult[]);
    } catch {
      setClusterPlaceResults([]);
    } finally {
      setIsClusterSearching(false);
    }
  };

  const handleClusterQueryChange = (value: string) => {
    setClusterPlaceQuery(value);
    setClusterPlaceResults([]);
    clearTimeout(clusterDebounceRef.current);
    if (value.trim().length >= 2) {
      clusterDebounceRef.current = setTimeout(() => runClusterSearch(value.trim()), 400);
    }
  };

  const applyClusterReplace = async (place: { name: string; lat: number; lng: number }) => {
    if (isClusterSaving || !selectedCluster) return;
    setIsClusterSaving(true);
    try {
      await Promise.all(
        selectedCluster.photos.map(photo =>
          apiRequest("PUT", `/api/photos/${photo.id}/location`, {
            coordinates: { lat: place.lat, lng: place.lng },
            location: place.name,
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ["/api/travel"] });
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/places/recent"] });
      closeClusterOverlay();
    } catch {
      toast({ title: "Couldn't change place", description: "Some photos may not have been updated. Please try again.", variant: "destructive" });
    } finally {
      setIsClusterSaving(false);
    }
  };

  const applyClusterLabel = async (rawLabel: string) => {
    if (isSavingLabel || !selectedCluster) return;
    const label = rawLabel.trim() || null;
    setIsSavingLabel(true);
    try {
      await Promise.all(
        selectedCluster.photos.map(photo =>
          apiRequest("PUT", `/api/photos/${photo.id}/location`, {
            coordinates: photo.coordinates,
            location: label,
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ["/api/travel"] });
      queryClient.invalidateQueries({ queryKey: ["/api/photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/places/recent"] });
      closeClusterOverlay();
    } catch {
      toast({ title: "Couldn't rename place", description: "Some photos may not have been updated. Please try again.", variant: "destructive" });
    } finally {
      setIsSavingLabel(false);
    }
  };

  const totalPhotos = placed.length;
  const totalPlaces = clusters.length;

  const mapCenter: [number, number] = clusters.length > 0
    ? [clusters[0].lat, clusters[0].lng]
    : [20, 0];
  const mapZoom = clusters.length > 0 ? 5 : 2;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden bg-neutral-50 dark:bg-gray-900">
        <Header />

        {/* Contextual batch placement bar — outside scroll area so it stays visible */}
        {selectMode && selectedUnplaced.size > 0 && (
          <div className="shrink-0 border-b border-neutral-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 md:px-6 py-3">
            {!pendingBatchPlace ? (
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 shrink-0">
                  Place {selectedUnplaced.size} {selectedUnplaced.size === 1 ? "memory" : "memories"}
                </p>

                {recentPlaces.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {recentPlaces.map(r => (
                      <button
                        key={r.name}
                        type="button"
                        onClick={() => setPendingBatchPlace(r)}
                        className="px-2.5 py-1 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-300 text-xs rounded-full border border-neutral-200 dark:border-neutral-600 transition-colors truncate max-w-[140px]"
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative flex-1 min-w-[160px]">
                  <input
                    value={batchPlaceQuery}
                    onChange={e => handleBatchQueryChange(e.target.value)}
                    onKeyDown={e => { if (e.key === "Escape") { setBatchPlaceQuery(""); setBatchPlaceResults([]); } }}
                    placeholder="Search for a place…"
                    className="w-full px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-sm rounded-md outline-none placeholder:text-neutral-400 border border-neutral-200 dark:border-neutral-600 focus:border-neutral-400"
                  />
                  {isBatchSearching && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">…</span>
                  )}
                  {batchPlaceResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border border-neutral-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-lg">
                      {batchPlaceResults.map((r, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => { setPendingBatchPlace(r); setBatchPlaceResults([]); setBatchPlaceQuery(""); }}
                          className="w-full text-left px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors border-t border-neutral-100 dark:border-neutral-700 first:border-t-0"
                        >
                          <span className="text-neutral-800 dark:text-neutral-200 text-sm block truncate">{r.name}</span>
                          {r.country && <span className="text-neutral-400 text-xs">{r.country}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate">
                  {pendingBatchPlace.name}
                </p>
                <div className="rounded overflow-hidden" style={{ height: "180px" }}>
                  <MapContainer
                    center={[pendingBatchPlace.lat, pendingBatchPlace.lng]}
                    zoom={10}
                    scrollWheelZoom={true}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <MapResizeFix />
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker
                      position={[pendingBatchPlace.lat, pendingBatchPlace.lng]}
                      draggable={true}
                      eventHandlers={{
                        dragend(e) {
                          const ll = e.target.getLatLng();
                          setPendingBatchPlace(prev => prev ? { ...prev, lat: ll.lat, lng: ll.lng } : null);
                        },
                      }}
                    />
                  </MapContainer>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => applyBatchPlace(pendingBatchPlace)}
                    disabled={isBatchSaving}
                    className="px-3 py-1.5 bg-neutral-800 dark:bg-neutral-200 hover:bg-neutral-700 dark:hover:bg-neutral-100 text-white dark:text-neutral-900 text-xs rounded-md transition-colors disabled:opacity-40"
                  >
                    {isBatchSaving ? "Saving…" : "Place these memories here"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingBatchPlace(null)}
                    className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                  >
                    Choose a different place
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6 app-content">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100">
              Travel your World
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Every place you've been, mapped through your memories.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-neutral-100 dark:border-gray-700">
              <div className="text-xs uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Places</div>
              <div className="text-2xl font-semibold text-neutral-800 dark:text-neutral-100 mt-1">
                {isLoading ? "—" : totalPlaces}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-neutral-100 dark:border-gray-700">
              <div className="text-xs uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Photos on the map</div>
              <div className="text-2xl font-semibold text-neutral-800 dark:text-neutral-100 mt-1">
                {isLoading ? "—" : totalPhotos}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-neutral-100 dark:border-gray-700">
              <div className="text-xs uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Unplaced photos</div>
              <div className="text-2xl font-semibold text-neutral-800 dark:text-neutral-100 mt-1">
                {isLoading ? "—" : unplacedCount}
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="isolate rounded-lg overflow-hidden border border-neutral-100 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800">
            <div className="h-[60vh] w-full">
              <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                scrollWheelZoom={true}
                style={{ height: "100%", width: "100%" }}
                worldCopyJump={true}
              >
                <MapResizeFix />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {clusters.map((cluster) => (
                  <Marker key={cluster.key} position={[cluster.lat, cluster.lng]}>
                    <Popup>
                      <div className="w-48">
                        <img
                          src={`/api/media/${cluster.photos[0].id}`}
                          alt={cluster.label}
                          className="w-full h-24 object-cover rounded mb-2"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                        <div className="font-semibold text-sm">{cluster.label}</div>
                        <div className="text-xs text-neutral-500 mt-1">
                          {cluster.photos.length} {cluster.photos.length === 1 ? "photo" : "photos"}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>

          {/* Your Places grid */}
          {!isLoading && clusters.length > 0 && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-3">
                Your Places
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {clusters.map((cluster) => (
                  <div
                    key={cluster.key}
                    onClick={() => setSelectedCluster(cluster)}
                    className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-neutral-100 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="h-32 bg-neutral-100 dark:bg-gray-700">
                      <img
                        src={`/api/media/${cluster.photos[0].id}`}
                        alt={cluster.label}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                    <div className="p-3">
                      <div className="font-semibold text-neutral-800 dark:text-neutral-100 truncate">
                        {cluster.label}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        {cluster.photos.length} {cluster.photos.length === 1 ? "memory" : "memories"} here
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Memories without a place yet */}
          {!isLoading && unplacedCount > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
                    Memories without a place yet
                  </h2>
                  <span className="text-sm text-neutral-400 dark:text-neutral-500">
                    {selectMode && selectedUnplaced.size > 0 ? `${selectedUnplaced.size} selected` : unplacedCount}
                  </span>
                </div>
                <button
                  onClick={selectMode ? cancelSelectMode : () => setSelectMode(true)}
                  className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                >
                  {selectMode ? "Cancel" : "Select"}
                </button>
              </div>

              {!selectMode && (
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-3">
                  Open a photo to add a place.
                </p>
              )}

              {/* Photo grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mt-3">
                {unplaced.map(photo => {
                  if (!selectMode) {
                    return <PhotoCard key={photo.id} photo={photo} allPhotos={unplaced} />;
                  }
                  const selected = selectedUnplaced.has(photo.id);
                  return (
                    <div
                      key={photo.id}
                      onClick={() => toggleSelectUnplaced(photo.id)}
                      className={`relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                        selected
                          ? "border-blue-600 ring-2 ring-blue-600/20"
                          : "border-transparent hover:border-neutral-300 dark:hover:border-gray-600"
                      }`}
                    >
                      <img
                        src={`/api/media/${photo.id}`}
                        alt={photo.fileName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className={`absolute top-1.5 right-1.5 rounded-full p-0.5 transition-colors ${
                        selected ? "bg-blue-600 text-white" : "bg-black/40 text-transparent"
                      }`}>
                        <Check className="h-3 w-3" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && placed.length === 0 && (
            <div className="mt-6 rounded-lg border border-dashed border-neutral-200 dark:border-gray-700 p-10 text-center">
              <div className="text-neutral-400 dark:text-neutral-500 text-sm mb-1">No location data yet</div>
              <div className="text-neutral-400 dark:text-neutral-500 text-xs">
                Open any photo and tap "Place on map" to add it here.
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Place detail overlay */}
      {selectedCluster && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeClusterOverlay}
        >
          <div
            className="relative w-full max-w-3xl max-h-[85vh] mx-4 rounded-2xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-neutral-100 dark:border-gray-800 shrink-0">
              <div className="flex-1 min-w-0 mr-3">
                <p className="text-xs uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-0.5">Place</p>

                {!editingClusterLabel ? (
                  <div className="group/label flex items-baseline gap-1.5">
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 leading-tight truncate">
                      {selectedCluster.label}
                    </h2>
                    <button
                      onClick={() => {
                        setEditingClusterLabel(true);
                        setClusterLabelInput(selectedCluster.label);
                        setEditingClusterPlace(false);
                        setPendingClusterPlace(null);
                      }}
                      title="Rename place"
                      className="opacity-0 group-hover/label:opacity-50 hover:!opacity-100 text-neutral-400 transition-opacity shrink-0"
                    >
                      <Tag className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      autoFocus
                      value={clusterLabelInput}
                      onChange={e => setClusterLabelInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") { e.preventDefault(); applyClusterLabel(clusterLabelInput); }
                        if (e.key === "Escape") { setEditingClusterLabel(false); setClusterLabelInput(""); }
                      }}
                      placeholder="Place name…"
                      className="text-lg font-semibold bg-transparent border-b border-neutral-300 dark:border-neutral-600 outline-none w-full text-neutral-900 dark:text-neutral-100 leading-tight placeholder:text-neutral-400 placeholder:font-normal"
                    />
                    <div className="flex items-center gap-3 mt-1.5">
                      <button
                        onClick={() => applyClusterLabel(clusterLabelInput)}
                        disabled={isSavingLabel}
                        className="text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:text-neutral-900 dark:hover:text-white transition-colors disabled:opacity-40"
                      >
                        {isSavingLabel ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => { setEditingClusterLabel(false); setClusterLabelInput(""); }}
                        className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {!editingClusterLabel && (
                  <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-0.5">
                    {selectedCluster.photos.length} {selectedCluster.photos.length === 1 ? "memory" : "memories"} here
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => {
                    setEditingClusterPlace(v => !v);
                    setEditingClusterLabel(false);
                    setClusterLabelInput("");
                  }}
                  title="Change place"
                  className={`p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-gray-800 transition-colors hover:text-neutral-700 dark:hover:text-neutral-200 ${editingClusterPlace ? "text-neutral-700 dark:text-neutral-200" : "text-neutral-400 opacity-60 hover:opacity-100"}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={closeClusterOverlay}
                  className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-gray-800 transition-colors text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Change place sub-panel */}
            {editingClusterPlace && (
              <div className="shrink-0 border-b border-neutral-100 dark:border-gray-800 px-5 py-4 bg-neutral-50 dark:bg-gray-800/50">
                {!pendingClusterPlace ? (
                  <>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                      Choose a different place for all memories here
                    </p>

                    {recentPlaces.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {recentPlaces.map(r => (
                          <button
                            key={r.name}
                            type="button"
                            onClick={() => setPendingClusterPlace(r)}
                            className="px-2.5 py-1 bg-white dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-300 text-xs rounded-full border border-neutral-200 dark:border-neutral-600 transition-colors truncate max-w-[140px]"
                          >
                            {r.name}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="relative">
                      <input
                        value={clusterPlaceQuery}
                        onChange={e => handleClusterQueryChange(e.target.value)}
                        onKeyDown={e => { if (e.key === "Escape") { setClusterPlaceQuery(""); setClusterPlaceResults([]); } }}
                        placeholder="Search for a place…"
                        className="w-full px-3 py-1.5 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-sm rounded-md outline-none placeholder:text-neutral-400 border border-neutral-200 dark:border-neutral-600 focus:border-neutral-400"
                      />
                      {isClusterSearching && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">…</span>
                      )}
                      {clusterPlaceResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border border-neutral-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-lg">
                          {clusterPlaceResults.map((r, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => { setPendingClusterPlace(r); setClusterPlaceResults([]); setClusterPlaceQuery(""); }}
                              className="w-full text-left px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors border-t border-neutral-100 dark:border-neutral-700 first:border-t-0"
                            >
                              <span className="text-neutral-800 dark:text-neutral-200 text-sm block truncate">{r.name}</span>
                              {r.country && <span className="text-neutral-400 text-xs">{r.country}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center mt-2">
                      <button
                        onClick={() => { setEditingClusterPlace(false); setClusterPlaceQuery(""); setClusterPlaceResults([]); setPendingClusterPlace(null); }}
                        className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors ml-auto"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100 mb-3 truncate">
                      {pendingClusterPlace.name}
                    </p>
                    <div className="rounded overflow-hidden mb-3" style={{ height: "180px" }}>
                      <MapContainer
                        center={[pendingClusterPlace.lat, pendingClusterPlace.lng]}
                        zoom={10}
                        scrollWheelZoom={true}
                        style={{ height: "100%", width: "100%" }}
                      >
                        <MapResizeFix />
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <Marker
                          position={[pendingClusterPlace.lat, pendingClusterPlace.lng]}
                          draggable={true}
                          eventHandlers={{
                            dragend(e) {
                              const ll = e.target.getLatLng();
                              setPendingClusterPlace(prev => prev ? { ...prev, lat: ll.lat, lng: ll.lng } : null);
                            },
                          }}
                        />
                      </MapContainer>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => applyClusterReplace(pendingClusterPlace)}
                        disabled={isClusterSaving}
                        className="px-3 py-1.5 bg-neutral-800 dark:bg-neutral-200 hover:bg-neutral-700 dark:hover:bg-neutral-100 text-white dark:text-neutral-900 text-xs rounded-md transition-colors disabled:opacity-40"
                      >
                        {isClusterSaving ? "Changing place…" : "Place these memories here"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingClusterPlace(null)}
                        className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                      >
                        Choose a different place
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Photos */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {selectedCluster.photos.map(photo => (
                  <PhotoCard key={photo.id} photo={photo} allPhotos={selectedCluster.photos} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
