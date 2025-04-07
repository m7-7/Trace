// Time periods for filtering
export const TIME_FILTERS = [
  { value: 'all', label: 'All Time' },
  { value: 'year', label: 'This Year' },
  { value: 'month', label: 'This Month' },
  { value: 'week', label: 'This Week' }
];

// Common photo categories
export const PHOTO_CATEGORIES = [
  { id: 'nature', name: 'Nature', icon: 'palm_tree' },
  { id: 'food', name: 'Food', icon: 'restaurant' },
  { id: 'people', name: 'People', icon: 'people' },
  { id: 'places', name: 'Places', icon: 'location_city' }
];

// Supported image types
export const SUPPORTED_IMAGE_TYPES = [
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'
];

// Supported video types
export const SUPPORTED_VIDEO_TYPES = [
  '.mp4', '.mov', '.avi', '.mkv', '.webm'
];

// Common search terms for demo with emoji hints
export const SEARCH_SUGGESTIONS = [
  { term: 'beach', emoji: '🏖️', description: 'Find sunny beach memories' },
  { term: 'sunset', emoji: '🌅', description: 'Beautiful sunset moments' },
  { term: 'coffee', emoji: '☕', description: 'Cozy coffee moments' },
  { term: 'mountain', emoji: '🏔️', description: 'Mountain adventures' },
  { term: 'winter', emoji: '❄️', description: 'Winter wonderland photos' },
  { term: 'summer', emoji: '☀️', description: 'Summer fun and sunshine' },
  { term: 'spring', emoji: '🌸', description: 'Spring blossoms and new beginnings' },
  { term: 'fall', emoji: '🍂', description: 'Fall colors and cozy moments' },
  { term: 'rain', emoji: '🌧️', description: 'Rainy day memories' },
  { term: 'city', emoji: '🏙️', description: 'Urban adventures' },
  { term: 'travel', emoji: '✈️', description: 'Travel memories from around the world' },
  { term: 'birthday', emoji: '🎂', description: 'Birthday celebrations' },
  { term: 'family', emoji: '👨‍👩‍👧‍👦', description: 'Family gatherings and moments' },
  { term: 'pet', emoji: '🐾', description: 'Precious pet photos' },
  { term: 'food', emoji: '🍽️', description: 'Delicious food memories' }
];

// Keep the original for backward compatibility
export const COMMON_SEARCH_TERMS = SEARCH_SUGGESTIONS.map(suggestion => suggestion.term);
