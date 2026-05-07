import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface ScanningModalProps {
  onClose: () => void;
}

export function ScanningModal({ onClose }: ScanningModalProps) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md dark:bg-gray-900 dark:border-gray-800">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-primary-50 dark:bg-primary-900/40 text-primary-500 dark:text-primary-400 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-neutral-800 dark:text-white">Scan Started</h3>
          <p className="text-neutral-500 dark:text-neutral-300 mt-1">
            The scan is running in the background. You can close this window — new photos will appear automatically when the scan finishes.
          </p>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={onClose}
            className="rounded-full dark:bg-primary-600 dark:hover:bg-primary-700 dark:text-white"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
