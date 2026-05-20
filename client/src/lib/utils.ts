import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getMemoryDate(photo: { takenAt: Date | null; createdAt: Date }): Date {
  return photo.takenAt ?? photo.createdAt;
}

export function hasKnownDate(photo: { takenAt: Date | null }): boolean {
  return photo.takenAt !== null;
}

export function getMemoryYear(photo: { takenAt: Date | null; createdAt: Date }): number {
  return getMemoryDate(photo).getFullYear();
}

export function formatMemoryDate(photo: { takenAt: Date | null; createdAt: Date }): string {
  return format(getMemoryDate(photo), "MMM d, yyyy");
}

export function formatMemoryDateFull(photo: { takenAt: Date | null; createdAt: Date }): string {
  return format(getMemoryDate(photo), "MMMM d, yyyy");
}

export function groupPhotosByYear<T extends { takenAt: Date | null; createdAt: Date }>(
  photos: T[]
): { year: string | null; photos: T[] }[] {
  const dated = new Map<string, T[]>();
  const undated: T[] = [];

  for (const photo of photos) {
    if (hasKnownDate(photo)) {
      const year = String(getMemoryYear(photo));
      if (!dated.has(year)) dated.set(year, []);
      dated.get(year)!.push(photo);
    } else {
      undated.push(photo);
    }
  }

  const groups: { year: string | null; photos: T[] }[] = Array.from(dated.entries()).map(
    ([year, yearPhotos]) => ({ year, photos: yearPhotos })
  );

  if (undated.length > 0) {
    groups.push({ year: null, photos: undated });
  }

  return groups;
}
