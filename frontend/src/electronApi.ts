export interface ElectronAPI {
  isElectron:       true;
  dataLoad:         () => Promise<string | null>;
  dataSave:         (json: string) => void;
  dataClear:        () => void;
  viewStateLoad:    () => Promise<string | null>;
  viewStateSave:    (json: string) => void;
  exportJson:       (json: string) => Promise<boolean>;
  importJson:       () => Promise<string | null>;
  appVersion:       () => Promise<string>;
  onWindowClosing:  (cb: () => void) => (() => void);
  closeConfirmed:   () => void;
}

declare global {
  interface Window { electronAPI?: ElectronAPI; }
}

export const isElectron = (): boolean =>
  typeof window !== 'undefined' && window.electronAPI?.isElectron === true;

export const getElectronAPI = (): ElectronAPI | null =>
  isElectron() ? (window.electronAPI as ElectronAPI) : null;
