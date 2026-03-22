import { contextBridge, ipcRenderer } from 'electron';
import type { LatencyMapApi, MeasurementProgressEvent, UpdateStatus } from '../shared/types';

const api: LatencyMapApi = {
  getCatalog: () => ipcRenderer.invoke('catalog:get'),
  getAppState: () => ipcRenderer.invoke('state:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  listCustomHosts: () => ipcRenderer.invoke('custom-hosts:list'),
  upsertCustomHost: (input) => ipcRenderer.invoke('custom-hosts:upsert', input),
  deleteCustomHost: (id) => ipcRenderer.invoke('custom-hosts:delete', id),
  runMeasurements: (request) => ipcRenderer.invoke('measurements:run', request),
  getAppVersion: () => ipcRenderer.invoke('version:get'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  openReleasesPage: () => ipcRenderer.invoke('updates:open-releases'),
  installDownloadedUpdate: () => ipcRenderer.invoke('updates:install'),
  getLogs: () => ipcRenderer.invoke('logs:get'),
  clearLogs: () => ipcRenderer.invoke('logs:clear'),
  onUpdateStatus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => {
      callback(status);
    };
    ipcRenderer.on('updates:status', listener);
    return () => ipcRenderer.removeListener('updates:status', listener);
  },
  onLogEntry: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, entry) => {
      callback(entry);
    };
    ipcRenderer.on('logs:entry', listener);
    return () => ipcRenderer.removeListener('logs:entry', listener);
  },
  onMeasurementProgress: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      event: MeasurementProgressEvent
    ) => {
      callback(event);
    };
    ipcRenderer.on('measurements:progress', listener);
    return () => ipcRenderer.removeListener('measurements:progress', listener);
  },
};

contextBridge.exposeInMainWorld('latencyMap', api);
