import { contextBridge, ipcRenderer } from 'electron';

import { createAcademicDesktopApi } from '../shared/api.js';

const api = createAcademicDesktopApi({
  invoke: (channel, value) => ipcRenderer.invoke(channel, value),
  subscribe: (channel, listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, value: unknown) => listener(value);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
});

contextBridge.exposeInMainWorld('academic', api);
