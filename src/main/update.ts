import {
  app,
  shell,
  type AppUpdaterEvents,
} from 'electron';
import electronUpdater from 'electron-updater';
import semver from 'semver';
import type { UpdateStatus } from '../shared/types';
import { writeLog } from './logger';

const { autoUpdater } = electronUpdater;

function resolveRepository(): { owner: string; repo: string } | null {
  const envRepo =
    process.env.LATENCYMAP_RELEASE_REPOSITORY || process.env.GITHUB_REPOSITORY;

  if (envRepo && envRepo.includes('/')) {
    const [owner, repo] = envRepo.split('/');
    return { owner, repo };
  }

  return { owner: 'paulomanrique', repo: 'latency-map' };
}

function getReleasesUrl(): string | null {
  const repository = resolveRepository();
  if (!repository) {
    return null;
  }
  return `https://github.com/${repository.owner}/${repository.repo}/releases`;
}

async function fetchLatestGitHubVersion(): Promise<string | undefined> {
  const repository = resolveRepository();
  if (!repository) {
    return undefined;
  }

  const url = `https://api.github.com/repos/${repository.owner}/${repository.repo}/releases/latest`;
  const response = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json' },
  });

  if (!response.ok) {
    throw new Error(`GitHub releases request failed with ${response.status}`);
  }

  const data = (await response.json()) as { tag_name?: string };
  return data.tag_name?.replace(/^v/, '');
}

export class UpdateManager {
  private status: UpdateStatus = {
    platform: process.platform,
    currentVersion: app.getVersion(),
    releasesUrl: getReleasesUrl(),
    status: 'idle',
    autoInstallSupported: process.platform === 'win32',
  };

  private listeners = new Set<(status: UpdateStatus) => void>();
  private inFlightCheck: Promise<UpdateStatus> | null = null;
  private cooldownUntil = 0;
  private releasesUnavailable = false;

  constructor() {
    if (process.platform === 'win32') {
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      this.bindWindowsEvents();
    }
  }

  private emit(partial: Partial<UpdateStatus>): UpdateStatus {
    this.status = { ...this.status, ...partial };
    for (const listener of this.listeners) {
      listener(this.status);
    }
    return this.status;
  }

  private bindWindowsEvents(): void {
    const updater = autoUpdater as unknown as AppUpdaterEvents & typeof autoUpdater;
    updater.on('checking-for-update', () => {
      writeLog('main', 'info', 'Checking for app updates on Windows.');
      this.emit({ status: 'checking', message: 'Checking for updates...' });
    });
    updater.on('update-available', (info) => {
      writeLog('main', 'info', `Update available: ${info.version}`);
      this.emit({
        status: 'available',
        latestVersion: info.version,
        message: 'Update available. Downloading...',
      });
    });
    updater.on('update-not-available', () => {
      writeLog('main', 'info', 'No update available.');
      this.emit({ status: 'not-available', message: 'You are on the latest version.' });
    });
    updater.on('download-progress', (progress) => {
      writeLog('main', 'info', `Update download progress: ${progress.percent.toFixed(0)}%`);
      this.emit({
        status: 'downloading',
        downloadProgress: progress.percent,
        message: `Downloading update ${progress.percent.toFixed(0)}%`,
      });
    });
    updater.on('update-downloaded', (info) => {
      writeLog('main', 'info', `Update downloaded: ${info.version}`);
      this.emit({
        status: 'downloaded',
        latestVersion: info.version,
        message: 'Update ready. Click to restart and install.',
      });
    });
    updater.on('error', (error) => {
      writeLog('main', 'error', `Updater error: ${error.message}`);
      this.emit({ status: 'error', message: error.message });
    });
  }

  subscribe(listener: (status: UpdateStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  async checkForUpdates(): Promise<UpdateStatus> {
    if (!app.isPackaged) {
      return this.status;
    }

    const now = Date.now();
    if (this.inFlightCheck) {
      return this.inFlightCheck;
    }

    if (this.releasesUnavailable) {
      return this.status;
    }

    if (this.cooldownUntil > now) {
      return this.status;
    }

    if (process.platform === 'win32' && app.isPackaged) {
      this.inFlightCheck = (async () => {
        this.emit({ status: 'checking', message: 'Checking for updates...' });
        try {
          await autoUpdater.checkForUpdates();
          return this.status;
        } catch (error) {
          this.cooldownUntil = Date.now() + 5 * 60 * 1000;
          return this.emit({
            status: 'error',
            message: (error as Error).message,
          });
        } finally {
          this.inFlightCheck = null;
        }
      })();
      return this.inFlightCheck;
    }

    this.inFlightCheck = (async () => {
      this.emit({ status: 'checking', message: 'Checking GitHub releases...' });
      writeLog('main', 'info', 'Checking GitHub Releases for updates.');
      try {
        const latestVersion = await fetchLatestGitHubVersion();
        this.cooldownUntil = 0;
        if (latestVersion && semver.gt(latestVersion, app.getVersion())) {
          writeLog('main', 'info', `Release update available: ${latestVersion}`);
          return this.emit({
            status: 'available',
            latestVersion,
            message: 'Update available on GitHub Releases.',
          });
        }
        writeLog('main', 'info', 'No newer GitHub release found.');
        return this.emit({
          status: 'not-available',
          latestVersion,
          message: 'You are on the latest version.',
        });
      } catch (error) {
        const rawMessage = (error as Error).message;
        const isMissingReleases = rawMessage.includes('404');
        this.cooldownUntil = Date.now() + (isMissingReleases ? 12 * 60 * 60 * 1000 : 5 * 60 * 1000);
        this.releasesUnavailable = isMissingReleases;
        const message = isMissingReleases
          ? 'GitHub Releases ainda nao esta disponivel para este repositorio.'
          : rawMessage;
        writeLog('main', 'error', `Failed to check updates: ${rawMessage}`);
        if (isMissingReleases) {
          writeLog('main', 'warn', 'Disabling further automatic update checks until restart.');
        }
        return this.emit({
          status: 'error',
          message,
        });
      } finally {
        this.inFlightCheck = null;
      }
    })();
    return this.inFlightCheck;
  }

  getCurrentStatus(): UpdateStatus {
    return this.status;
  }

  async openReleasesPage(): Promise<void> {
    const releasesUrl = getReleasesUrl();
    if (releasesUrl) {
      writeLog('main', 'info', `Opening releases page: ${releasesUrl}`);
      await shell.openExternal(releasesUrl);
    }
  }

  installDownloadedUpdate(): void {
    if (this.status.status === 'downloaded' && process.platform === 'win32') {
      writeLog('main', 'info', 'Installing downloaded update.');
      autoUpdater.quitAndInstall();
    }
  }
}

export const updateManager = new UpdateManager();
