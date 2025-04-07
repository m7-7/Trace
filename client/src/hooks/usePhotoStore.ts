import { create } from 'zustand';
import { Photo } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';

type PhotoState = {
  photos: Photo[];
  isLoading: boolean;
  error: string | null;
  fetchPhotos: (limit?: number, offset?: number) => Promise<void>;
  searchPhotos: (query: string) => Promise<void>;
  toggleFavorite: (id: number) => Promise<void>;
};

export const usePhotoStore = create<PhotoState>((set, get) => ({
  photos: [],
  isLoading: false,
  error: null,
  
  fetchPhotos: async (limit = 50, offset = 0) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/photos?limit=${limit}&offset=${offset}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch photos: ${response.statusText}`);
      }
      
      const photos: Photo[] = await response.json();
      set({ photos, isLoading: false });
    } catch (error) {
      console.error('Error fetching photos:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch photos', 
        isLoading: false 
      });
    }
  },
  
  searchPhotos: async (query: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/photos/search?q=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to search photos: ${response.statusText}`);
      }
      
      const photos: Photo[] = await response.json();
      set({ photos, isLoading: false });
    } catch (error) {
      console.error('Error searching photos:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to search photos', 
        isLoading: false 
      });
    }
  },
  
  toggleFavorite: async (id: number) => {
    const { photos } = get();
    try {
      const response = await apiRequest('PUT', `/api/photos/${id}/favorite`, null);
      
      if (!response.ok) {
        throw new Error(`Failed to toggle favorite: ${response.statusText}`);
      }
      
      const updatedPhoto: Photo = await response.json();
      const updatedPhotos = photos.map(photo => 
        photo.id === id ? { ...photo, favorite: updatedPhoto.favorite } : photo
      );
      
      set({ photos: updatedPhotos });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to toggle favorite' });
    }
  }
}));
