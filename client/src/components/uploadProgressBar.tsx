import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface UploadProgressBarProps {
  isUploading: boolean;
  progress: number;
  fileName?: string;
  onClose?: () => void;
}

export function UploadProgressBar({
  isUploading,
  progress,
  fileName,
  onClose
}: UploadProgressBarProps) {
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    if (isUploading) {
      setVisible(true);
    } else {
      // When upload is complete, wait 2 seconds before hiding
      const timer = setTimeout(() => {
        setVisible(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isUploading]);
  
  // Handle close button click
  const handleClose = () => {
    setVisible(false);
    if (onClose) onClose();
  };
  
  if (!visible) return null;
  
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 shadow-md border-b border-neutral-200 dark:border-gray-700"
        >
          <div className="container mx-auto max-w-6xl py-2 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-grow mr-4">
                <div className="bg-primary-100 dark:bg-primary-900/40 rounded-full p-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
                <div className="flex-grow">
                  <p className="text-sm font-medium text-gray-700 dark:text-white">
                    {progress < 100 ? 'Uploading...' : 'Upload complete!'}
                  </p>
                  {fileName && (
                    <p className="text-xs text-gray-500 dark:text-gray-300 truncate max-w-md">
                      {fileName}
                    </p>
                  )}
                  <Progress 
                    value={progress} 
                    className="h-1.5 mt-1 dark:bg-gray-700" 
                  />
                </div>
              </div>
              <button 
                onClick={handleClose}
                className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-gray-700 text-neutral-500 dark:text-neutral-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}