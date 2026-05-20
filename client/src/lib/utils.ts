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
): { year: string; photos: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const photo of photos) {
    const year = String(getMemoryYear(photo));
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year)!.push(photo);
  }
  return Array.from(groups.entries()).map(([year, yearPhotos]) => ({ year, photos: yearPhotos }));
}
