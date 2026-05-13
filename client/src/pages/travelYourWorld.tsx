import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "@/lib/leafletConfig";
import { useQuery } from "@tanstack/react-query";
import { Photo } from "@shared/schema";
import { PhotoCard } from "@/components/photoCard";
import { X } from "lucide-react";

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
              <div className="flex items-baseline gap-2 mb-3">
                <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
                  Memories without a place yet
                </h2>
                <span className="text-sm text-neutral-400 dark:text-neutral-500">{unplacedCount}</span>
              </div>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-3">
                Open a photo to add a place.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {unplaced.map(photo => (
                  <PhotoCard key={photo.id} photo={photo} allPhotos={unplaced} />
                ))}
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
          onClick={() => setSelectedCluster(null)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[85vh] mx-4 rounded-2xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-neutral-100 dark:border-gray-800 shrink-0">
              <div>
                <p className="text-xs uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-0.5">Place</p>
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 leading-tight">
                  {selectedCluster.label}
                </h2>
                <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-0.5">
                  {selectedCluster.photos.length} {selectedCluster.photos.length === 1 ? "memory" : "memories"} here
                </p>
              </div>
              <button
                onClick={() => setSelectedCluster(null)}
                className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-gray-800 transition-colors text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

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
