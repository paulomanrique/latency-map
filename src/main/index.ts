import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { catalog } from '../shared/catalog';
import type {
  AppSettings,
  CustomHost,
  MeasurementProgressEvent,
  ProviderCatalog,
  RunMeasurementsRequest,
  UpdateStatus,
} from '../shared/types';
import { fetchRemoteCatalog, loadCachedCatalog } from './catalog-updater';
import { runNativeMeasurements } from './native';
import { appStore } from './store';
import { updateManager } from './update';
import { clearLogs, getLogs, writeLog } from './logger';

let mainWindow: BrowserWindow | null = null;
let activeCatalog: ProviderCatalog = catalog;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1240,
    minHeight: 760,
    backgroundColor: '#0e1119',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  writeLog('main', 'info', 'Application started.');
  ipcMain.handle('catalog:get', async () => activeCatalog);
  ipcMain.handle('state:get', async () => appStore.read());
  ipcMain.handle('logs:get', async () => getLogs());
  ipcMain.handle('logs:clear', async () => clearLogs());
  ipcMain.handle('settings:save', async (_event, settings: AppSettings) =>
    {
      writeLog('main', 'info', `Settings saved: rounds=${settings.rounds}`);
      return appStore.updateSettings(settings);
    }
  );
  ipcMain.handle('custom-hosts:list', async () => appStore.listCustomHosts());
  ipcMain.handle(
    'custom-hosts:upsert',
    async (
      _event,
      input: Pick<CustomHost, 'id' | 'name' | 'location' | 'host' | 'enabled'>
    ) => {
      writeLog(
        'main',
        'info',
        `${input.id ? 'Updated' : 'Created'} custom host ${input.name} (${input.host})`
      );
      return appStore.upsertCustomHost(input);
    }
  );
  ipcMain.handle('custom-hosts:delete', async (_event, id: string) => {
    writeLog('main', 'warn', `Deleted custom host ${id}`);
    return appStore.deleteCustomHost(id);
  });
  ipcMain.handle(
    'measurements:run',
    async (_event, request: RunMeasurementsRequest) => {
      writeLog('main', 'info', `Received run request for ${request.targets.length} target(s).`);
      const batch = await runNativeMeasurements(request, (progress: MeasurementProgressEvent) => {
        mainWindow?.webContents.send('measurements:progress', progress);
      });
      writeLog(
        'main',
        'info',
        `Measurement batch finished with ${batch.results.length} result(s).`
      );
      return batch;
    }
  );
  ipcMain.handle('version:get', async () => ({
    version: app.getVersion(),
    platform: process.platform,
  }));
  ipcMain.handle('updates:check', async (): Promise<UpdateStatus> =>
    updateManager.checkForUpdates()
  );
  ipcMain.handle('updates:open-releases', async () =>
    updateManager.openReleasesPage()
  );
  ipcMain.handle('updates:install', async () => updateManager.installDownloadedUpdate());

  updateManager.subscribe((status) => {
    mainWindow?.webContents.send('updates:status', status);
  });

  // Load cached catalog (fast, from disk), then fetch latest from GitHub in background
  loadCachedCatalog()
    .then((cached) => {
      if (cached && cached.providers.length > 0) {
        activeCatalog = cached;
        writeLog('main', 'info', `Using cached catalog (${cached.providers.length} providers).`);
        mainWindow?.webContents.send('catalog:updated', activeCatalog);
      }
    })
    .catch(() => {});

  // Fetch from GitHub in background (non-blocking)
  fetchRemoteCatalog()
    .then((remote) => {
      if (remote && remote.providers.length > 0) {
        activeCatalog = remote;
        writeLog('main', 'info', `Catalog updated from GitHub (${remote.providers.length} providers).`);
        mainWindow?.webContents.send('catalog:updated', activeCatalog);
      }
    })
    .catch(() => {});

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  writeLog('main', 'info', 'All windows closed.');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
