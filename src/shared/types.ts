export type ProviderId = string;

export interface HostSeed {
  id: string;
  providerId: ProviderId;
  providerName: string;
  providerIcon: string;
  city: string;
  country: string;
  continent: string;
  latitude: number | null;
  longitude: number | null;
  location: string;
  regionLabel: string;
  hostname: string;
  search: string;
}

export interface QueryBuilderState {
  selectedContinents: string[];
  selectedCountries: string[];
  selectedCities: string[];
  selectedProviderIds: string[];
  includeCustomHosts: boolean;
  distanceKm: number | null;
}

export interface UserReferenceLocation {
  latitude: number;
  longitude: number;
  label: string;
  source: 'device' | 'ip' | 'manual';
}

export interface ProviderCatalog {
  providers: Array<{
    id: ProviderId;
    name: string;
    icon: string;
    website?: string;
    hosts: HostSeed[];
  }>;
}

export interface CustomHost {
  id: string;
  name: string;
  location: string;
  host: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  rounds: number;
  concurrency: number;
}

export type ShareSortKey = 'latency' | 'distance' | 'hops';
export type ShareSortDir = 'asc' | 'desc';

export interface ShareSortState {
  key: ShareSortKey;
  dir: ShareSortDir;
}

export interface MeasurementHop {
  hop: number;
  ipAddress: string | null;
  hostname: string | null;
  lastRttMs: number | null;
  avgRttMs: number | null;
  bestRttMs: number | null;
  worstRttMs: number | null;
  jitterAvgMs: number | null;
  lossPercent: number;
  sent: number;
  received: number;
  timedOut: boolean;
}

export interface MeasurementResult {
  targetId: string;
  targetHost: string;
  targetName: string;
  targetLocation: string;
  providerId: string;
  providerName: string;
  resolvedAddress: string | null;
  avgLatencyMs: number | null;
  bestLatencyMs: number | null;
  worstLatencyMs: number | null;
  jitterMs: number | null;
  packetLossPercent: number;
  hopCount: number;
  status: 'good' | 'medium' | 'bad' | 'offline';
  qualityScore: number;
  error?: string;
  hops: MeasurementHop[];
}

export interface MeasurementBatch {
  startedAt: string;
  completedAt: string;
  settings: AppSettings;
  degradedPermissions: boolean;
  cancelled?: boolean;
  warning?: string;
  results: MeasurementResult[];
}

export interface PersistedState {
  settings: AppSettings;
  customHosts: CustomHost[];
  lastBatch: MeasurementBatch | null;
  shares: ShareRecord[];
}

export interface RunMeasurementsRequest {
  settings: AppSettings;
  targets: Array<{
    id: string;
    host: string;
    providerId: string;
    providerName: string;
    targetName: string;
    targetLocation: string;
  }>;
}

export interface UpdateStatus {
  platform: NodeJS.Platform;
  currentVersion: string;
  releasesUrl: string | null;
  status:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error';
  latestVersion?: string;
  downloadProgress?: number;
  message?: string;
  autoInstallSupported: boolean;
}

export interface VersionInfo {
  version: string;
  platform: NodeJS.Platform;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  source: 'renderer' | 'main' | 'native';
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface MeasurementProgressEvent {
  type: 'batch-started' | 'target-started' | 'target-finished' | 'batch-finished';
  startedAt?: string;
  completedAt?: string;
  targetId?: string;
  cancelled?: boolean;
  warning?: string;
  result?: MeasurementResult;
}

export interface NativeMeasureRequestTarget {
  id: string;
  host: string;
  providerId: string;
  providerName: string;
  targetName: string;
  targetLocation: string;
}

export interface NativeMeasureRequest {
  rounds: number;
  targets: NativeMeasureRequestTarget[];
}

export interface NativeMeasureResponse {
  startedAt: string;
  completedAt: string;
  degradedPermissions: boolean;
  warning?: string;
  results: MeasurementResult[];
}

export interface ShareHostSnapshot {
  id: string;
  kind: 'catalog' | 'custom';
  providerId: string;
  providerName: string;
  providerIcon: string;
  city: string;
  country: string;
  continent: string;
  location: string;
  regionLabel: string;
  hostname: string;
  distanceKm: number | null;
  result: MeasurementResult | null;
}

export interface ShareSummarySnapshot {
  bestTargetId: string | null;
  worstTargetId: string | null;
  averageLatencyMs: number | null;
  goodCount: number;
  mediumCount: number;
  badCount: number;
  hostCount: number;
}

export interface ShareViewSnapshot {
  mode: 'query' | 'provider' | 'custom';
  activeProviderId: string | null;
  activeProviderName: string | null;
  locationMode: 'locations' | 'distance';
  search: string;
  sort: ShareSortState;
}

export interface SharePayloadV1 {
  schemaVersion: 1;
  appVersion: string;
  createdAt: string;
  query: QueryBuilderState;
  settings: AppSettings;
  batch: MeasurementBatch;
  view: ShareViewSnapshot;
  referenceLabel: string | null;
  referenceSource: UserReferenceLocation['source'] | null;
  containsCustomHosts: boolean;
  hosts: ShareHostSnapshot[];
  summary: ShareSummarySnapshot;
}

export interface CreateShareResponse {
  publicId: string;
  publicUrl: string;
  deleteToken: string;
}

export interface DeleteShareRequest {
  publicId: string;
  deleteToken: string;
}

export interface ShareRecord {
  publicId: string;
  publicUrl: string;
  deleteToken: string;
  createdAt: string;
  containsCustomHosts: boolean;
}

export interface LatencyMapApi {
  getCatalog: () => Promise<ProviderCatalog>;
  getAppState: () => Promise<PersistedState>;
  saveSettings: (settings: AppSettings) => Promise<AppSettings>;
  listCustomHosts: () => Promise<CustomHost[]>;
  upsertCustomHost: (
    input: Pick<CustomHost, 'id' | 'name' | 'location' | 'host' | 'enabled'>
  ) => Promise<CustomHost>;
  deleteCustomHost: (id: string) => Promise<void>;
  runMeasurements: (request: RunMeasurementsRequest) => Promise<MeasurementBatch>;
  cancelMeasurements: () => Promise<boolean>;
  createShare: (payload: SharePayloadV1) => Promise<CreateShareResponse>;
  deleteShare: (request: DeleteShareRequest) => Promise<void>;
  getAppVersion: () => Promise<VersionInfo>;
  checkForUpdates: () => Promise<UpdateStatus>;
  openReleasesPage: () => Promise<void>;
  installDownloadedUpdate: () => Promise<void>;
  getLogs: () => Promise<LogEntry[]>;
  clearLogs: () => Promise<void>;
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
  onLogEntry: (callback: (entry: LogEntry) => void) => () => void;
  onMeasurementProgress: (callback: (event: MeasurementProgressEvent) => void) => () => void;
  onCatalogUpdated: (callback: (catalog: ProviderCatalog) => void) => () => void;
}
