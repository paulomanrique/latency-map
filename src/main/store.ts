import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  AppSettings,
  CustomHost,
  MeasurementBatch,
  PersistedState,
  ShareRecord,
} from '../shared/types';

const DEFAULT_SETTINGS: AppSettings = { rounds: 5, concurrency: 5 };

const DEFAULT_STATE: PersistedState = {
  settings: DEFAULT_SETTINGS,
  customHosts: [],
  lastBatch: null,
  shares: [],
};

export class AppStore {
  private readonly filePath: string;

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'state.json');
  }

  async read(): Promise<PersistedState> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as PersistedState;
      const state: PersistedState = {
        settings: {
          rounds: parsed.settings?.rounds ?? DEFAULT_SETTINGS.rounds,
          concurrency: parsed.settings?.concurrency ?? DEFAULT_SETTINGS.concurrency,
        },
        customHosts: parsed.customHosts ?? [],
        lastBatch: null,
        shares: parsed.shares ?? [],
      };

      if (parsed.lastBatch) {
        await this.write(state);
      }

      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return DEFAULT_STATE;
      }
      throw error;
    }
  }

  async write(state: PersistedState): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(state, null, 2), 'utf8');
  }

  async updateSettings(settings: AppSettings): Promise<AppSettings> {
    const state = await this.read();
    state.settings = settings;
    await this.write(state);
    return settings;
  }

  async listCustomHosts(): Promise<CustomHost[]> {
    const state = await this.read();
    return state.customHosts;
  }

  async upsertCustomHost(
    input: Pick<CustomHost, 'id' | 'name' | 'location' | 'host' | 'enabled'>
  ): Promise<CustomHost> {
    const state = await this.read();
    const now = new Date().toISOString();
    const existing = input.id
      ? state.customHosts.find((host) => host.id === input.id)
      : undefined;

    const record: CustomHost = existing
      ? {
          ...existing,
          ...input,
          updatedAt: now,
        }
      : {
          id: input.id || crypto.randomUUID(),
          name: input.name,
          location: input.location,
          host: input.host,
          enabled: input.enabled,
          createdAt: now,
          updatedAt: now,
        };

    state.customHosts = existing
      ? state.customHosts.map((host) => (host.id === record.id ? record : host))
      : [...state.customHosts, record];

    await this.write(state);
    return record;
  }

  async deleteCustomHost(id: string): Promise<void> {
    const state = await this.read();
    state.customHosts = state.customHosts.filter((host) => host.id !== id);
    await this.write(state);
  }

  async saveLastBatch(batch: MeasurementBatch): Promise<void> {
    void batch;
  }

  async saveShareRecord(record: ShareRecord): Promise<void> {
    const state = await this.read();
    state.shares = [
      record,
      ...state.shares.filter((share) => share.publicId !== record.publicId),
    ].slice(0, 50);
    await this.write(state);
  }

  async deleteShareRecord(publicId: string): Promise<void> {
    const state = await this.read();
    state.shares = state.shares.filter((share) => share.publicId !== publicId);
    await this.write(state);
  }
}

export const appStore = new AppStore();
