import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from './ipcChannels';

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron:    true,
  dataLoad:      (): Promise<string | null> => ipcRenderer.invoke(IPC.DATA_LOAD),
  dataSave:      (json: string): void       => ipcRenderer.send(IPC.DATA_SAVE, json),
  dataClear:     (): void                   => ipcRenderer.send(IPC.DATA_CLEAR),
  viewStateLoad: (): Promise<string | null> => ipcRenderer.invoke(IPC.VIEW_STATE_LOAD),
  viewStateSave: (json: string): void       => ipcRenderer.send(IPC.VIEW_STATE_SAVE, json),
  exportJson:    (json: string): Promise<boolean>     => ipcRenderer.invoke(IPC.EXPORT_JSON, json),
  importJson:    (): Promise<string | null>           => ipcRenderer.invoke(IPC.IMPORT_JSON),
  appVersion:    (): Promise<string>                  => ipcRenderer.invoke(IPC.APP_VERSION),
  onWindowClosing:  (cb: () => void): (() => void) => {
    ipcRenderer.on(IPC.WINDOW_CLOSING, cb);
    return () => { ipcRenderer.removeListener(IPC.WINDOW_CLOSING, cb); };
  },
  closeConfirmed:   (): void => ipcRenderer.send(IPC.WINDOW_CLOSE_CONFIRMED),
  print:            (): void => ipcRenderer.send(IPC.PRINT),
  zoomDelta:        (delta: number): void => ipcRenderer.send(IPC.ZOOM_DELTA, delta),
});
