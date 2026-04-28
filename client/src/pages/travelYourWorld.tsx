import { useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

type PhotoLocation = {
  id: number;
  name: string;
  country: string;
  coordinates: { lat: number; lng: number };
  photoCount: number;
  coverImage: string;
  lastVisited: string;
};

const MOCK_PHOTO_LOCATIONS: PhotoLocation[] = [
  {
    id: 1,
    name: "Paris",
    country: "France",
    coordinates: { lat: 48.8566, lng: 2.3522 },
    photoCount: 124,
    coverImage:
      "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400",
    lastVisited: "Aug 2025",
  },
  {
    id: 2,
    name: "Santorini",
    country: "Greece",
    coordinates: { lat: 36.3932, lng: 25.4615 },
    photoCount: 87,
    coverImage:
      "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=400",
    lastVisited: "Jul 2025",
  },
  {
    id: 3,
    name: "Tokyo",
    country: "Japan",
    coordinates: { lat: 35.6762, lng: 139.6503 },
    photoCount: 213,
    coverImage:
      "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400",
    lastVisited: "Mar 2025",
  },
  {
    id: 4,
    name: "New York",
    country: "USA",
    coordinates: { lat: 40.7128, lng: -74.006 },
    photoCount: 156,
    coverImage:
      "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400",
    lastVisited: "Dec 2024",
  },
  {
    id: 5,
    name: "Reykjavík",
    country: "Iceland",
    coordinates: { lat: 64.1466, lng: -21.9426 },
    photoCount: 64,
    coverImage:
      "https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=400",
    lastVisited: "Feb 2024",
  },
  {
    id: 6,
    name: "Cape Town",
    country: "South Africa",
    coordinates: { lat: -33.9249, lng: 18.4241 },
    photoCount: 48,
    coverImage:
      "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=400",
    lastVisited: "Oct 2023",
  },
  {
    id: 7,
    name: "Sydney",
    country: "Australia",
    coordinates: { lat: -33.8688, lng: 151.2093 },
    photoCount: 95,
    coverImage:
      "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=400",
    lastVisited: "Jan 2024",
  },
  {
    id: 8,
    name: "Rio de Janeiro",
    country: "Brazil",
    coordinates: { lat: -22.9068, lng: -43.1729 },
    photoCount: 73,
    coverImage:
      "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=400",
    lastVisited: "Apr 2024",
  },
];

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

export default function TravelYourWorld() {
  const totalPhotos = MOCK_PHOTO_LOCATIONS.reduce(
    (sum, l) => sum + l.photoCount,
    0,
  );
  const totalPlaces = MOCK_PHOTO_LOCATIONS.length;
  const totalCountries = new Set(MOCK_PHOTO_LOCATIONS.map((l) => l.country))
    .size;

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
              <div className="text-xs uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Places
              </div>
              <div className="text-2xl font-semibold text-neutral-800 dark:text-neutral-100 mt-1">
                {totalPlaces}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-neutral-100 dark:border-gray-700">
              <div className="text-xs uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Countries
              </div>
              <div className="text-2xl font-semibold text-neutral-800 dark:text-neutral-100 mt-1">
                {totalCountries}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-neutral-100 dark:border-gray-700">
              <div className="text-xs uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Photos on the map
              </div>
              <div className="text-2xl font-semibold text-neutral-800 dark:text-neutral-100 mt-1">
                {totalPhotos}
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="rounded-lg overflow-hidden border border-neutral-100 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800">
            <div className="h-[60vh] w-full">
              <MapContainer
                center={[20, 0]}
                zoom={2}
                scrollWheelZoom={true}
                style={{ height: "100%", width: "100%" }}
                worldCopyJump={true}
              >
                <MapResizeFix />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {MOCK_PHOTO_LOCATIONS.map((loc) => (
                  <Marker
                    key={loc.id}
                    position={[loc.coordinates.lat, loc.coordinates.lng]}
                  >
                    <Popup>
                      <div className="w-52">
                        <img
                          src={loc.coverImage}
                          alt={loc.name}
                          className="w-full h-24 object-cover rounded mb-2"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                        <div className="font-semibold text-sm">
                          {loc.name}, {loc.country}
                        </div>
                        <div className="text-xs text-neutral-500 mt-1">
                          {loc.photoCount} photos · {loc.lastVisited}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>

          {/* Locations grid */}
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-3">
              Your Places
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {MOCK_PHOTO_LOCATIONS.map((loc) => (
                <div
                  key={loc.id}
                  className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-neutral-100 dark:border-gray-700 hover:shadow-md transition-shadow"
                >
                  <div className="h-32 bg-neutral-100 dark:bg-gray-700">
                    <img
                      src={loc.coverImage}
                      alt={loc.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                  <div className="p-3">
                    <div className="font-semibold text-neutral-800 dark:text-neutral-100">
                      {loc.name}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      {loc.country}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 flex justify-between">
                      <span>{loc.photoCount} photos</span>
                      <span>{loc.lastVisited}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
