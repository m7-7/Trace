import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getMemoryDate(photo: { takenAt: Date | string | number | null; createdAt: Date | string | number }): Date {
  const raw = photo.takenAt ?? photo.createdAt;
  return raw instanceof Date ? raw : new Date(raw as string | number);
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

export function getMemoryMonth(photo: { takenAt: Date | null; createdAt: Date }): number {
  return getMemoryDate(photo).getMonth();
}

export function formatMemoryMonth(photo: { takenAt: Date | null; createdAt: Date }): string {
  return format(getMemoryDate(photo), "MMMM");
}

export type PhotoMonthGroup<T> = { label: string; photos: T[] };
export type PhotoYearGroup<T> =
  | { year: string; months: PhotoMonthGroup<T>[] }
  | { year: null; photos: T[] };

export function groupPhotosByYear<T extends { takenAt: Date | null; createdAt: Date }>(
  photos: T[]
): PhotoYearGroup<T>[] {
  const dated = new Map<string, Map<string, T[]>>();
  const undated: T[] = [];

  for (const photo of photos) {
    if (hasKnownDate(photo)) {
      const year = String(getMemoryYear(photo));
      const monthLabel = formatMemoryMonth(photo);
      if (!dated.has(year)) dated.set(year, new Map());
      const monthMap = dated.get(year)!;
      if (!monthMap.has(monthLabel)) monthMap.set(monthLabel, []);
      monthMap.get(monthLabel)!.push(photo);
    } else {
      undated.push(photo);
    }
  }

  const groups: PhotoYearGroup<T>[] = Array.from(dated.entries()).map(([year, monthMap]) => ({
    year,
    months: Array.from(monthMap.entries()).map(([label, monthPhotos]) => ({
      label,
      photos: monthPhotos,
    })),
  }));

  if (undated.length > 0) {
    groups.push({ year: null, photos: undated });
  }

  return groups;
}
