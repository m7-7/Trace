import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { Folder } from "@shared/schema";

interface ScanningModalProps {
  onClose: () => void;
}

export function ScanningModal({ onClose }: ScanningModalProps) {
  const [progress, setProgress] = useState(0);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [filesProcessed, setFilesProcessed] = useState(0);
  const [isScanning, setIsScanning] = useState(true);
  
  // Get folders from API
  const { data: folders = [] } = useQuery<Folder[]>({
    queryKey: ['/api/folders'],
  });
  
  // Simulate scanning progress
  useEffect(() => {
    if (!isScanning) return;
    
    const folders = ["Pictures", "Documents/Photos", "Downloads/Camera"];
    let folderIndex = 0;
    let progressValue = 0;
    let filesCount = 0;
    
    const interval = setInterval(() => {
      progressValue += Math.random() * 4;
      filesCount += Math.floor(Math.random() * 10) + 1;
      
      if (progressValue >= 100) {
        progressValue = 100;
        setIsScanning(false);
        clearInterval(interval);
      } else if (progressValue > 30 && folderIndex < folders.length - 1) {
        folderIndex++;
      }
      
      setProgress(Math.min(progressValue, 100));
      setFilesProcessed(filesCount);
      setCurrentFolder(folders[folderIndex]);
    }, 300);
    
    return () => clearInterval(interval);
  }, [isScanning]);
  
  return (
    <Dialog open={true} onOpenChange={() => isScanning ? null : onClose()}>
      <DialogContent className="sm:max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-primary-50 text-primary-500 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-neutral-800">Scanning Files</h3>
          <p className="text-neutral-500 mt-1">Discovering your memories from local folders</p>
        </div>
        
        <div className="mb-4">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-2 text-xs text-neutral-500">
            <span>Processing: {filesProcessed} files</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>
        
        {currentFolder && (
          <div className="border border-neutral-100 rounded-lg p-3 mb-4 bg-neutral-50">
            <p className="text-sm text-neutral-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="inline-block mr-1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              Currently scanning: {currentFolder}
            </p>
          </div>
        )}
        
        <div className="flex justify-end space-x-3">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isScanning}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => setIsScanning(false)} 
            disabled={!isScanning}
          >
            Continue in Background
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
