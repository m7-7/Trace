interface Window {
  electronAPI?: {
    pickFolder: () => Promise<string | null>;
  };
}
