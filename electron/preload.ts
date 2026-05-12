import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('pick-folder'),
});
