import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getMemoryDate(photo: { takenAt: Date | null; createdAt: Date }): Date {
  return photo.takenAt ?? photo.createdAt;
}

export function hasKnownDate(photo: { takenAt: Date | null }): boolean {
  return photo.takenAt !== null;
}
