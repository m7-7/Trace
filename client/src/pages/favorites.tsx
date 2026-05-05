import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Photo } from "@shared/schema";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { PhotoCard } from "@/components/photoCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "nature", label: "Nature" },
  { value: "food", label: "Food" },
  { value: "people", label: "People" },
  { value: "places", label: "Places" },
];

const TIME_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "year", label: "This Year" },
  { value: "month", label: "This Month" },
  { value: "week", label: "This Week" },
];

const SORT_OPTIONS = [
  { value: "date-desc", label: "Newest First" },
  { value: "date-asc", label: "Oldest First" },
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
];

export default function Favorites() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");
  const [limit, setLimit] = useState(24);

  const { data: photos = [], isLoading } = useQuery<Photo[]>({
    queryKey: ["/api/photos/favorites"],
  });

  const filteredPhotos = useMemo(() => {
    let result = [...photos];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.fileName?.toLowerCase().includes(q) ||
          p.location?.toLowerCase().includes(q) ||
          p.contentTags?.some((t) => t.toLowerCase().includes(q)),
      );
    }

    if (category !== "all") {
      result = result.filter((p) =>
        p.contentTags?.some((t) => t.toLowerCase() === category.toLowerCase()),
      );
    }

    if (timeFilter !== "all") {
      const now = new Date();
      const start = new Date();
      if (timeFilter === "year") start.setFullYear(now.getFullYear() - 1);
      if (timeFilter === "month") start.setMonth(now.getMonth() - 1);
      if (timeFilter === "week") start.setDate(now.getDate() - 7);
      result = result.filter((p) => new Date(p.createdAt) >= start);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "date-asc":
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        case "name-asc":
          return (a.fileName || "").localeCompare(b.fileName || "");
        case "name-desc":
          return (b.fileName || "").localeCompare(a.fileName || "");
        case "date-desc":
        default:
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      }
    });

    return result;
  }, [photos, search, category, timeFilter, sortBy]);

  const visiblePhotos = filteredPhotos.slice(0, limit);
  const hasMore = filteredPhotos.length > limit;
  const activeFilterCount =
    (search ? 1 : 0) +
    (category !== "all" ? 1 : 0) +
    (timeFilter !== "all" ? 1 : 0);

  const clearFilters = () => {
    setSearch("");
    setCategory("all");
    setTimeFilter("all");
    setSortBy("date-desc");
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden bg-neutral-50 dark:bg-gray-900">
        <Header />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 app-content">
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-yellow-500"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
              <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100">
                Favorite Photos
              </h1>
            </div>
            <p className="text-neutral-500 dark:text-neutral-400 mt-1">
              {photos.length} starred photo{photos.length === 1 ? "" : "s"} in
              your collection
            </p>
          </div>

          {/* Filter bar */}
          <div className="bg-blue-700 rounded-lg p-4 mb-6 border border-blue-800">
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <div className="flex-1 relative">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <Input
                  placeholder="Search by name, location, or tag…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 text-white placeholder:text-white/60 dark:bg-gray-900 dark:border-gray-700"
                />
              </div>

              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full md:w-[160px] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="w-full md:w-[140px] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full md:w-[160px] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
                >
                  Clear ({activeFilterCount})
                </Button>
              )}
            </div>
          </div>

          {/* Results */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg overflow-hidden shadow-sm"
                >
                  <Skeleton className="aspect-[4/3] w-full" />
                  <div className="p-2">
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : photos.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-10 text-center border border-dashed border-neutral-200 dark:border-gray-700">
              <div className="mb-4 inline-flex items-center justify-center h-14 w-14 rounded-full bg-yellow-50 dark:bg-yellow-900/20 text-yellow-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              </div>
              <h3 className="text-lg font-medium text-neutral-700 dark:text-neutral-200 mb-1">
                No Favorite Photos Yet
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400">
                Tap the star on any photo to add it to your favorites.
              </p>
            </div>
          ) : filteredPhotos.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-10 text-center border border-dashed border-neutral-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-neutral-700 dark:text-neutral-200 mb-1">
                No photos match your filters
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400 mb-4">
                Try adjusting or clearing your filters to see more results.
              </p>
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Showing {visiblePhotos.length} of {filteredPhotos.length}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {visiblePhotos.map((photo) => (
                  <PhotoCard key={photo.id} photo={photo} />
                ))}
              </div>
              {hasMore && (
                <div className="mt-8 text-center">
                  <Button
                    variant="outline"
                    onClick={() => setLimit((l) => l + 24)}
                  >
                    Load More
                  </Button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
