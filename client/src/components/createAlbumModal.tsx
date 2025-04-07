import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Plus, Smile, Calendar, Search } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { COMMON_SEARCH_TERMS } from "@/lib/constants";

interface CreateAlbumModalProps {
  onClose: () => void;
  initialTerms?: string[];
}

// Color categories for tags
type TagCategory = 'nature' | 'mood' | 'event' | 'time' | 'people' | 'place' | 'other';

interface TagInfo {
  term: string;
  category: TagCategory;
}

// Mood categories with predefined terms (with dark mode support)
const moodCategories = [
  { name: "Happy", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100", terms: ["happy", "joy", "celebration", "smile", "fun"] },
  { name: "Calm", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100", terms: ["calm", "peaceful", "serene", "quiet", "relaxed"] },
  { name: "Energetic", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100", terms: ["energetic", "active", "exciting", "adventure"] },
  { name: "Nostalgic", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100", terms: ["nostalgic", "memories", "throwback", "vintage"] },
  { name: "Romantic", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100", terms: ["romantic", "love", "couple", "date", "anniversary"] },
  { name: "Contemplative", color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100", terms: ["thoughtful", "reflective", "introspective"] }
];

export function CreateAlbumModal({ onClose, initialTerms = [] }: CreateAlbumModalProps) {
  const [albumName, setAlbumName] = useState("");
  const [searchTerms, setSearchTerms] = useState<TagInfo[]>(initialTerms.map(term => ({ term, category: 'other' })));
  const [newTerm, setNewTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("manual");
  const [selectedMood, setSelectedMood] = useState("");
  
  // Get tag color based on category (with dark mode support)
  const getTagColor = (category: TagCategory): string => {
    switch(category) {
      case 'nature': return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
      case 'mood': return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100";
      case 'event': return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100";
      case 'time': return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100";
      case 'people': return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100";
      case 'place': return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100";
    }
  };
  
  // Determine category based on term
  const getCategoryForTerm = (term: string): TagCategory => {
    const termLower = term.toLowerCase();
    
    if (termLower.match(/forest|mountain|beach|ocean|lake|river|nature|tree|flower|garden|park|sunset|sunrise/)) {
      return 'nature';
    }
    
    if (termLower.match(/happy|sad|angry|excited|joyful|content|peaceful|nostalgic|melancholy/)) {
      return 'mood';
    }
    
    if (termLower.match(/birthday|wedding|vacation|holiday|anniversary|graduation|party|celebration/)) {
      return 'event';
    }
    
    if (termLower.match(/morning|evening|night|dawn|dusk|winter|summer|spring|fall|january|february|march|april|may|june|july|august|september|october|november|december/)) {
      return 'time';
    }
    
    if (termLower.match(/family|friend|father|mother|sister|brother|child|baby|parent|coworker|pet/)) {
      return 'people';
    }
    
    if (termLower.match(/home|office|city|country|travel|school|restaurant|cafe|park|street|building/)) {
      return 'place';
    }
    
    return 'other';
  };
  
  const handleAddTerm = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && newTerm.trim()) {
      e.preventDefault();
      if (!searchTerms.some(t => t.term === newTerm.trim())) {
        const category = getCategoryForTerm(newTerm.trim());
        setSearchTerms([...searchTerms, { term: newTerm.trim(), category }]);
      }
      setNewTerm("");
    }
  };

  const handleManuallyAddTerm = (term: string) => {
    if (!searchTerms.some(t => t.term === term)) {
      const category = getCategoryForTerm(term);
      setSearchTerms([...searchTerms, { term, category }]);
    }
  };
  
  const handleRemoveTerm = (term: string) => {
    setSearchTerms(searchTerms.filter(t => t.term !== term));
  };

  const handleMoodSelection = (mood: string) => {
    setSelectedMood(mood);
    const category = moodCategories.find(m => m.name === mood);
    
    if (category) {
      // Generate a mood-based album name if none is set
      if (!albumName) {
        setAlbumName(`${mood} Moments`);
      }
      
      // Add mood terms
      const newTerms = [...searchTerms];
      category.terms.forEach(term => {
        if (!newTerms.some(t => t.term === term)) {
          newTerms.push({ term, category: 'mood' });
        }
      });
      setSearchTerms(newTerms);
    }
  };
  
  const handleCreateAlbum = async () => {
    if (!albumName.trim()) {
      toast({
        title: "Album name required",
        description: "Please provide a name for your album",
        variant: "destructive"
      });
      return;
    }
    
    if (searchTerms.length === 0) {
      toast({
        title: "Search terms required",
        description: "Please add at least one search term",
        variant: "destructive"
      });
      return;
    }
    
    setIsCreating(true);
    
    try {
      const albumData = {
        name: albumName,
        searchTerms: searchTerms.map(t => t.term),
        dateRangeStart: startDate ? new Date(startDate).toISOString() : null,
        dateRangeEnd: endDate ? new Date(endDate).toISOString() : null,
        createdAt: new Date().toISOString(),
      };
      
      const result = await apiRequest("POST", "/api/albums", albumData);
      const newAlbum = await result.json();
      
      queryClient.invalidateQueries({ queryKey: ['/api/albums'] });
      
      toast({
        title: "Album Created",
        description: `"${albumName}" has been created with ${newAlbum.photoCount || 0} photos`
      });
      
      // Navigate to the new album
      navigate(`/albums/${newAlbum.id}`);
      onClose();
    } catch (error) {
      console.error("Error creating album:", error);
      toast({
        title: "Error",
        description: "Failed to create album. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };
  
  // Suggested terms list for quick selection
  const suggestedTerms = COMMON_SEARCH_TERMS.filter(term => 
    !searchTerms.some(t => t.term === term)
  ).slice(0, 12);
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md dark:bg-gray-900 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="dark:text-neutral-100">Create Memory Album</DialogTitle>
        </DialogHeader>
        
        <div className="mb-4">
          <label htmlFor="album-name" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Album Name</label>
          <Input
            id="album-name"
            className="w-full"
            placeholder="e.g., Winter Morning Coffee"
            value={albumName}
            onChange={(e) => setAlbumName(e.target.value)}
          />
        </div>
        
        <Tabs defaultValue="manual" className="mb-4" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="manual" className="flex items-center gap-1">
              <Search size={14} /> Manual
            </TabsTrigger>
            <TabsTrigger value="mood" className="flex items-center gap-1">
              <Smile size={14} /> Mood
            </TabsTrigger>
            <TabsTrigger value="date" className="flex items-center gap-1">
              <Calendar size={14} /> Date
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="manual" className="pt-3">
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Search Terms</label>
              <div className="flex flex-wrap gap-2 p-2 border border-neutral-200 dark:border-gray-700 rounded-lg mb-2 bg-neutral-50 dark:bg-gray-800 min-h-[60px]">
                {searchTerms.map(tag => (
                  <Badge key={tag.term} variant="secondary" className={`${getTagColor(tag.category)} hover:opacity-90`}>
                    {tag.term}
                    <button
                      onClick={() => handleRemoveTerm(tag.term)}
                      className="ml-1 hover:text-red-700 dark:hover:text-red-300"
                    >
                      <X size={14} />
                    </button>
                  </Badge>
                ))}
                <Input
                  className="flex-grow min-w-[100px] bg-transparent border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 p-1 h-7"
                  placeholder="Add more terms..."
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  onKeyDown={handleAddTerm}
                />
              </div>
              
              <div className="mt-3">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Suggested Terms</label>
                <div className="flex flex-wrap gap-2">
                  {suggestedTerms.map(term => (
                    <Badge 
                      key={term} 
                      variant="outline" 
                      className="cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-950"
                      onClick={() => handleManuallyAddTerm(term)}
                    >
                      + {term}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="mood" className="pt-3">
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Select a Mood</label>
              <div className="grid grid-cols-2 gap-2">
                {moodCategories.map(mood => (
                  <Button 
                    key={mood.name}
                    variant={selectedMood === mood.name ? "default" : "outline"}
                    className={`justify-start ${selectedMood === mood.name ? "" : mood.color} h-auto py-3 px-4`}
                    onClick={() => handleMoodSelection(mood.name)}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{mood.name}</span>
                      <span className="text-xs opacity-70">{mood.terms.slice(0, 2).join(", ")}</span>
                    </div>
                  </Button>
                ))}
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Selected Terms</label>
                <div className="flex flex-wrap gap-2 p-2 border border-neutral-200 dark:border-gray-700 rounded-lg bg-neutral-50 dark:bg-gray-800 min-h-[60px]">
                  {searchTerms.map(tag => (
                    <Badge key={tag.term} variant="secondary" className={`${getTagColor(tag.category)} hover:opacity-90`}>
                      {tag.term}
                      <button
                        onClick={() => handleRemoveTerm(tag.term)}
                        className="ml-1 hover:text-red-700 dark:hover:text-red-300"
                      >
                        <X size={14} />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="date" className="pt-3">
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Select Date Range</label>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Start Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">End Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
              </div>
              
              <div className="mt-2">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Quick Selections</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="justify-start dark:border-gray-700 dark:hover:border-gray-600" onClick={() => {
                    const now = new Date();
                    const lastMonth = new Date();
                    lastMonth.setMonth(now.getMonth() - 1);
                    setStartDate(lastMonth.toISOString().split('T')[0]);
                    setEndDate(now.toISOString().split('T')[0]);
                    if (!albumName) setAlbumName("Last Month's Memories");
                  }}>Last Month</Button>
                  <Button variant="outline" className="justify-start dark:border-gray-700 dark:hover:border-gray-600" onClick={() => {
                    const now = new Date();
                    const lastYear = new Date();
                    lastYear.setFullYear(now.getFullYear() - 1);
                    setStartDate(lastYear.toISOString().split('T')[0]);
                    setEndDate(now.toISOString().split('T')[0]);
                    if (!albumName) setAlbumName("Year in Review");
                  }}>Past Year</Button>
                  <Button variant="outline" className="justify-start dark:border-gray-700 dark:hover:border-gray-600" onClick={() => {
                    const now = new Date();
                    const thisYearStart = new Date(now.getFullYear(), 0, 1);
                    setStartDate(thisYearStart.toISOString().split('T')[0]);
                    setEndDate(now.toISOString().split('T')[0]);
                    if (!albumName) setAlbumName(`${now.getFullYear()} Collection`);
                  }}>This Year</Button>
                  <Button variant="outline" className="justify-start dark:border-gray-700 dark:hover:border-gray-600" onClick={() => {
                    const now = new Date();
                    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    setStartDate(thisMonthStart.toISOString().split('T')[0]);
                    setEndDate(now.toISOString().split('T')[0]);
                    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                    if (!albumName) setAlbumName(`${monthNames[now.getMonth()]} ${now.getFullYear()}`);
                  }}>This Month</Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreateAlbum} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Album"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
