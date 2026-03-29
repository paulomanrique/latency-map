import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  AppSettings,
  CreateShareResponse,
  CustomHost,
  LogEntry,
  MeasurementBatch,
  MeasurementProgressEvent,
  ProviderCatalog,
  QueryBuilderState,
  RunMeasurementsRequest,
  ShareRecord,
  SharePayloadV1,
  UpdateStatus,
  UserReferenceLocation,
} from '../../shared/types';
import { requestBrowserLocation, requestIpLocation } from './lib/location';
import {
  buildCustomDisplayHosts,
  filterCatalogHosts,
  flattenCatalogHosts,
  getAvailableCities,
  getAvailableCountries,
  getUniqueContinents,
  searchMatch,
  sortDisplayHosts,
  makeSortComparator,
  type DisplayHost,
  type SortKey,
  type SortState,
} from './lib/models';
import { buildSharePayload, getActiveProviderName } from './lib/share';

type ViewMode = 'query' | 'custom' | 'shares';
type LocationMode = 'locations' | 'distance';

function toggleSort(current: SortState, key: SortKey): SortState {
  if (current.key === key) {
    return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  }
  return { key, dir: 'asc' };
}

function SortableHeader({
  label,
  sortKey,
  current,
  onSort,
  style,
}: {
  label: string;
  sortKey: SortKey;
  current: SortState;
  onSort: (next: SortState) => void;
  style?: React.CSSProperties;
}) {
  const active = current.key === sortKey;
  const arrow = active ? (current.dir === 'asc' ? ' ▲' : ' ▼') : '';
  return (
    <th
      className={`sortable-th${active ? ' sort-active' : ''}`}
      style={{ ...style, cursor: 'pointer', userSelect: 'none' }}
      onClick={() => onSort(toggleSort(current, sortKey))}
    >
      {label}{arrow}
    </th>
  );
}

interface HostEditorState {
  id?: string;
  name: string;
  location: string;
  host: string;
  enabled: boolean;
}

interface ReferenceDraft {
  label: string;
  latitude: string;
  longitude: string;
}

const EMPTY_EDITOR: HostEditorState = {
  name: '',
  location: '',
  host: '',
  enabled: true,
};

const EMPTY_QUERY: QueryBuilderState = {
  selectedContinents: [],
  selectedCountries: [],
  selectedCities: [],
  selectedProviderIds: [],
  includeCustomHosts: false,
  distanceKm: null,
};

function formatLatency(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}ms`;
}

function formatDistance(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)} km`;
}

function formatAgo(dateIso: string | null): string {
  if (!dateIso) return 'No scans yet';
  const diffSeconds = Math.max(
    0,
    Math.round((Date.now() - new Date(dateIso).getTime()) / 1000)
  );
  if (diffSeconds < 60) return `Updated ${diffSeconds}s ago`;
  const diffMinutes = Math.round(diffSeconds / 60);
  return `Updated ${diffMinutes}m ago`;
}

function getStatusClass(status: DisplayHost['result'] extends infer R ? R : never): string {
  const value = (status as DisplayHost['result'])?.status;
  if (value === 'good') return 'badge-good';
  if (value === 'medium') return 'badge-medium';
  return 'badge-bad';
}

function getStatusLabel(result: DisplayHost['result']): string {
  if (!result) return 'Pending';
  if (result.status === 'offline') return 'Offline';
  return result.status[0].toUpperCase() + result.status.slice(1);
}

function getQualityClass(score: number): string {
  if (score >= 70) return 'qf-good';
  if (score >= 40) return 'qf-medium';
  return 'qf-bad';
}

function getQualityWidth(score: number): string {
  return `${Math.max(8, Math.round(score))}%`;
}

function formatTracerouteText(host: DisplayHost): string {
  if (!host.result?.hops.length) {
    return `${host.hostname}\nNo traceroute data available.`;
  }

  return [
    `Traceroute ${host.hostname}`,
    ...host.result.hops.map((hop, index) => {
      const previous = host.result?.hops[index - 1]?.avgRttMs ?? 0;
      const delta = hop.avgRttMs === null ? null : Math.round(hop.avgRttMs - previous);
      const hopTarget = hop.timedOut
        ? 'Request timeout'
        : hop.hostname ?? hop.ipAddress ?? 'Unknown hop';
      const ip = hop.ipAddress ? ` (${hop.ipAddress})` : '';
      const rtt = hop.avgRttMs === null ? '* * *' : `${Math.round(hop.avgRttMs)}ms`;
      const deltaLabel = delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta}ms`;
      return `${hop.hop}. ${hopTarget}${ip}  ${rtt}  ${deltaLabel}`;
    }),
  ].join('\n');
}

function summarizeHosts(hosts: DisplayHost[]) {
  const results = hosts.map((host) => host.result).filter((result) => result !== null);
  const online = results.filter((result) => result.avgLatencyMs !== null);
  const sorted = [...online].sort((a, b) => (a.avgLatencyMs ?? 0) - (b.avgLatencyMs ?? 0));
  const average =
    online.length > 0
      ? online.reduce((sum, result) => sum + (result.avgLatencyMs ?? 0), 0) / online.length
      : null;

  return {
    best: sorted[0] ?? null,
    worst: sorted.at(-1) ?? null,
    average,
    goodCount: results.filter((result) => result.status === 'good').length,
    mediumCount: results.filter((result) => result.status === 'medium').length,
    badCount: results.filter((result) => result.status === 'bad' || result.status === 'offline').length,
  };
}

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('latencymap-theme');
    return saved === 'light' ? 'light' : 'dark';
  });
  const [catalog, setCatalog] = useState<ProviderCatalog | null>(null);
  const [settings, setSettings] = useState<AppSettings>({ rounds: 5, concurrency: 5 });
  const [customHosts, setCustomHosts] = useState<CustomHost[]>([]);
  const [shareRecords, setShareRecords] = useState<ShareRecord[]>([]);
  const [batch, setBatch] = useState<MeasurementBatch | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('query');
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'latency', dir: 'asc' });
  const [expandedHostId, setExpandedHostId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomHost | null>(null);
  const [hostEditor, setHostEditor] = useState<HostEditorState>(EMPTY_EDITOR);
  const [version, setVersion] = useState('0.1.0');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [runningTargetIds, setRunningTargetIds] = useState<string[]>([]);
  const [query, setQuery] = useState<QueryBuilderState>(EMPTY_QUERY);
  const [locationMode, setLocationMode] = useState<LocationMode>('locations');
  const [referenceLocation, setReferenceLocation] = useState<UserReferenceLocation | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referenceBusy, setReferenceBusy] = useState(false);
  const [referenceDraft, setReferenceDraft] = useState<ReferenceDraft>({
    label: '',
    latitude: '',
    longitude: '',
  });
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareWarningPayload, setShareWarningPayload] = useState<SharePayloadV1 | null>(null);
  const [shareSuccess, setShareSuccess] = useState<(CreateShareResponse & {
    containsCustomHosts: boolean;
  }) | null>(null);
  const logsBodyRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef(settings);

  function pushRendererLog(level: LogEntry['level'], message: string) {
    setLogs((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        source: 'renderer',
        level,
        message,
      },
    ].slice(-500));
  }

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    function handleEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (shareSuccess) setShareSuccess(null);
        else if (shareWarningPayload) setShareWarningPayload(null);
        if (deleteTarget) setDeleteTarget(null);
        else if (editorOpen) setEditorOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
      }
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [settingsOpen, editorOpen, deleteTarget, shareSuccess, shareWarningPayload]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('latencymap-theme', theme);
  }, [theme]);

  useEffect(() => {
    const load = async () => {
      const [catalogData, state, versionInfo, existingLogs] = await Promise.all([
        window.latencyMap.getCatalog(),
        window.latencyMap.getAppState(),
        window.latencyMap.getAppVersion(),
        window.latencyMap.getLogs(),
      ]);
      setCatalog(catalogData);
      setSettings(state.settings);
      setCustomHosts(state.customHosts);
      setShareRecords(state.shares);
      setBatch(state.lastBatch);
      setVersion(versionInfo.version);
      setLogs(existingLogs);
      setUpdateStatus({
        platform: versionInfo.platform,
        currentVersion: versionInfo.version,
        releasesUrl: null,
        status: 'idle',
        autoInstallSupported: versionInfo.platform === 'win32',
      });
      setQuery((current) => ({
        ...current,
        selectedProviderIds:
          current.selectedProviderIds.length > 0
            ? current.selectedProviderIds
            : catalogData.providers.map((provider) => provider.id),
      }));
    };

    void load();
    const unsubscribe = window.latencyMap.onUpdateStatus(setUpdateStatus);
    const unsubscribeLogs = window.latencyMap.onLogEntry((entry) => {
      setLogs((current) => [...current, entry].slice(-500));
    });
    const unsubscribeProgress = window.latencyMap.onMeasurementProgress(
      (event: MeasurementProgressEvent) => {
        setBatch((current) => {
          if (event.type === 'batch-started') {
            return {
              startedAt: event.startedAt ?? new Date().toISOString(),
              completedAt: event.startedAt ?? new Date().toISOString(),
              settings: settingsRef.current,
              degradedPermissions: false,
              results: [],
            };
          }

          if (!current) {
            return current;
          }

          if (event.type === 'target-finished' && event.result) {
            const withoutTarget = current.results.filter(
              (result) => result.targetId !== event.result?.targetId
            );
            const results = [...withoutTarget, event.result].sort((left, right) => {
              const leftLatency = left.avgLatencyMs ?? Number.POSITIVE_INFINITY;
              const rightLatency = right.avgLatencyMs ?? Number.POSITIVE_INFINITY;
              if (leftLatency !== rightLatency) {
                return leftLatency - rightLatency;
              }
              return left.packetLossPercent - right.packetLossPercent;
            });
            return { ...current, results };
          }

          if (event.type === 'batch-finished') {
            return {
              ...current,
              completedAt: event.completedAt ?? current.completedAt,
              cancelled: event.cancelled,
              warning: event.warning,
            };
          }

          return current;
        });

        if (event.type === 'target-started' && event.targetId) {
          setRunningTargetIds((current) =>
            current.includes(event.targetId) ? current : [...current, event.targetId]
          );
        }
        if (event.type === 'target-finished' && event.targetId) {
          setRunningTargetIds((current) => current.filter((id) => id !== event.targetId));
        }
        if (event.type === 'batch-finished') {
          setRunningTargetIds([]);
          if (event.cancelled) {
            pushRendererLog('warn', event.warning ?? 'Measurement run cancelled.');
          }
        }
      }
    );
    const unsubscribeCatalog = window.latencyMap.onCatalogUpdated((updated) => {
      setCatalog(updated);
      setQuery((current) => ({
        ...current,
        selectedProviderIds: updated.providers.map((provider) => provider.id),
      }));
      pushRendererLog('info', `Catalog updated: ${updated.providers.length} providers.`);
    });
    void window.latencyMap.checkForUpdates();
    pushRendererLog('info', 'Renderer initialized.');
    return () => {
      unsubscribe();
      unsubscribeLogs();
      unsubscribeProgress();
      unsubscribeCatalog();
    };
  }, []);

  useEffect(() => {
    if (logsExpanded && logsBodyRef.current) {
      logsBodyRef.current.scrollTop = logsBodyRef.current.scrollHeight;
    }
  }, [logs, logsExpanded]);

  async function resolveReferenceLocation(source: 'device' | 'ip' = 'device') {
    setReferenceBusy(true);
    setReferenceError(null);
    try {
      const location = source === 'device' ? await requestBrowserLocation() : await requestIpLocation();
      setReferenceLocation(location);
      setReferenceDraft({
        label: location.label,
        latitude: location.latitude.toFixed(4),
        longitude: location.longitude.toFixed(4),
      });
      pushRendererLog('info', `Reference location set from ${location.source}: ${location.label}`);
    } catch (error) {
      if (source === 'device') {
        pushRendererLog('warn', 'Browser geolocation failed; falling back to IP location.');
        try {
          const fallback = await requestIpLocation();
          setReferenceLocation(fallback);
          setReferenceDraft({
            label: fallback.label,
            latitude: fallback.latitude.toFixed(4),
            longitude: fallback.longitude.toFixed(4),
          });
          pushRendererLog('info', `Reference location set from ip: ${fallback.label}`);
        } catch (ipError) {
          setReferenceError((ipError as Error).message);
          pushRendererLog('error', `Reference location failed: ${(ipError as Error).message}`);
        }
      } else {
        setReferenceError((error as Error).message);
        pushRendererLog('error', `Reference location failed: ${(error as Error).message}`);
      }
    } finally {
      setReferenceBusy(false);
    }
  }

  useEffect(() => {
    void resolveReferenceLocation('device');
  }, []);

  const sortedProviders = useMemo(
    () =>
      catalog
        ? [...catalog.providers].sort((left, right) => left.name.localeCompare(right.name))
        : [],
    [catalog]
  );

  const catalogHosts = useMemo(
    () => (catalog ? flattenCatalogHosts(catalog, batch) : []),
    [catalog, batch]
  );
  const customDisplayHosts = useMemo(
    () => buildCustomDisplayHosts(customHosts, batch),
    [customHosts, batch]
  );

  const continents = useMemo(() => getUniqueContinents(catalogHosts), [catalogHosts]);
  const countries = useMemo(
    () => getAvailableCountries(catalogHosts, query.selectedContinents),
    [catalogHosts, query.selectedContinents]
  );
  const cities = useMemo(
    () => getAvailableCities(catalogHosts, query.selectedCountries),
    [catalogHosts, query.selectedCountries]
  );

  const filteredCatalogHosts = useMemo(
    () => filterCatalogHosts(catalogHosts, query, referenceLocation),
    [catalogHosts, query, referenceLocation]
  );

  const rankedHosts = useMemo(() => {
    const allHosts = [
      ...filteredCatalogHosts,
      ...(query.includeCustomHosts ? customDisplayHosts : []),
    ];
    return allHosts.filter((host) => searchMatch(host, search)).sort(makeSortComparator(sort));
  }, [customDisplayHosts, filteredCatalogHosts, query.includeCustomHosts, search, sort]);

  const filteredCustomHosts = useMemo(
    () => customDisplayHosts.filter((host) => searchMatch(host, search)).sort(makeSortComparator(sort)),
    [customDisplayHosts, search, sort]
  );
  const filteredShareRecords = useMemo(
    () =>
      shareRecords.filter((share) => {
        if (!search.trim()) return true;
        const term = search.trim().toLowerCase();
        return (
          share.publicId.toLowerCase().includes(term) ||
          share.publicUrl.toLowerCase().includes(term)
        );
      }),
    [search, shareRecords]
  );

  const providerHosts = useMemo(() => {
    if (!activeProviderId) {
      return [];
    }

    return catalogHosts
      .filter((host) => host.providerId === activeProviderId)
      .filter((host) => searchMatch(host, search))
      .sort(makeSortComparator(sort));
  }, [activeProviderId, catalogHosts, search, sort]);

  const activeProvider = useMemo(
    () => sortedProviders.find((provider) => provider.id === activeProviderId) ?? null,
    [activeProviderId, sortedProviders]
  );

  function buildCurrentSharePayload(): SharePayloadV1 {
    if (!batch?.results.length) {
      throw new Error('Run a measurement before creating a share.');
    }

    const currentViewMode =
      viewMode === 'custom' ? 'custom' : activeProviderId ? 'provider' : 'query';
    const currentHosts =
      viewMode === 'custom' ? filteredCustomHosts : activeProviderId ? providerHosts : rankedHosts;

    if (currentHosts.length === 0) {
      throw new Error('No hosts are visible in the current view.');
    }

    const payload = buildSharePayload({
      appVersion: version,
      query,
      settings,
      batch,
      view: {
        mode: currentViewMode,
        activeProviderId,
        activeProviderName: getActiveProviderName(catalog, activeProviderId),
        locationMode,
        search,
        sort,
      },
      referenceLocation,
      hosts: currentHosts,
    });

    if (payload.batch.results.length === 0) {
      throw new Error('The current view has no measurement results to share.');
    }

    return payload;
  }

  async function uploadShare(payload: SharePayloadV1) {
    setShareBusy(true);
    setShareError(null);
    try {
      const result = await window.latencyMap.createShare(payload);
      setShareWarningPayload(null);
      setShareSuccess({
        ...result,
        containsCustomHosts: payload.containsCustomHosts,
      });
      setShareRecords((current) => [
        {
          publicId: result.publicId,
          publicUrl: result.publicUrl,
          deleteToken: result.deleteToken,
          createdAt: payload.createdAt,
          containsCustomHosts: payload.containsCustomHosts,
        },
        ...current.filter((share) => share.publicId !== result.publicId),
      ].slice(0, 50));
      pushRendererLog('info', `Share created: ${result.publicUrl}`);
    } catch (shareRequestError) {
      const message = (shareRequestError as Error).message;
      setShareError(message);
      pushRendererLog('error', `Share failed: ${message}`);
    } finally {
      setShareBusy(false);
    }
  }

  function handleShareClick() {
    try {
      const payload = buildCurrentSharePayload();
      setShareSuccess(null);
      if (payload.containsCustomHosts) {
        setShareWarningPayload(payload);
        return;
      }
      void uploadShare(payload);
    } catch (shareBuildError) {
      const message = (shareBuildError as Error).message;
      setShareError(message);
      pushRendererLog('warn', message);
    }
  }

  async function handleDeleteShare(share: Pick<ShareRecord, 'publicId' | 'deleteToken'>) {
    setShareBusy(true);
    setShareError(null);
    try {
      await window.latencyMap.deleteShare({
        publicId: share.publicId,
        deleteToken: share.deleteToken,
      });
      setShareRecords((current) => current.filter((item) => item.publicId !== share.publicId));
      pushRendererLog('warn', `Share deleted: ${share.publicId}`);
      setShareSuccess((current) => (current?.publicId === share.publicId ? null : current));
    } catch (deleteError) {
      const message = (deleteError as Error).message;
      setShareError(message);
      pushRendererLog('error', `Share delete failed: ${message}`);
    } finally {
      setShareBusy(false);
    }
  }

  async function runMeasurements() {
    if (!catalog) return;
    setRunning(true);
    setCancelling(false);
    setError(null);
    setRunningTargetIds([]);
    try {
      const makeTarget = (host: DisplayHost) => ({
        id: host.id,
        host: host.hostname,
        providerId: host.providerId,
        providerName: host.providerName,
        targetName: host.regionLabel,
        targetLocation: host.location,
      });

      let targets: ReturnType<typeof makeTarget>[] = [];
      let runContext = 'query builder';

      if (viewMode === 'custom') {
        targets = filteredCustomHosts.map(makeTarget);
        runContext = 'custom hosts';
      } else if (activeProviderId) {
        targets = providerHosts.map(makeTarget);
        runContext = `${activeProvider?.name ?? activeProviderId} provider`;
      } else {
        const catalogTargets = filteredCatalogHosts.map(makeTarget);
        const customTargets = query.includeCustomHosts ? customDisplayHosts.map(makeTarget) : [];
        targets = [...catalogTargets, ...customTargets];
      }

      if (targets.length === 0) {
        setError(
          viewMode === 'custom'
            ? 'No custom hosts are available to run.'
            : activeProviderId
              ? 'No hosts are available for this provider.'
              : 'No hosts match the current query.'
        );
        pushRendererLog('warn', `Run aborted because ${runContext} returned no hosts.`);
        setRunning(false);
        return;
      }

      const request: RunMeasurementsRequest = {
        settings,
        targets,
      };

      for (const target of request.targets) {
        pushRendererLog('info', `Scheduled target ${target.targetName} (${target.host})`);
      }
      pushRendererLog(
        'info',
        `Running measurements for ${request.targets.length} target(s) in ${runContext} context.`
      );
      const result = await window.latencyMap.runMeasurements(request);
      setBatch(result);
      pushRendererLog(
        result.cancelled ? 'warn' : 'info',
        result.cancelled
          ? `Run cancelled after ${result.results.length} result(s).`
          : `Run completed with ${result.results.length} result(s).`
      );
    } catch (runError) {
      setError((runError as Error).message);
      pushRendererLog('error', `Run failed: ${(runError as Error).message}`);
    } finally {
      setCancelling(false);
      setRunning(false);
    }
  }

  async function cancelMeasurements() {
    if (!running || cancelling) {
      return;
    }

    setCancelling(true);
    try {
      const cancelled = await window.latencyMap.cancelMeasurements();
      if (!cancelled) {
        setCancelling(false);
      }
    } catch (cancelError) {
      setCancelling(false);
      setError((cancelError as Error).message);
      pushRendererLog('error', `Cancel failed: ${(cancelError as Error).message}`);
    }
  }

  function handleRunButtonClick() {
    if (running) {
      void cancelMeasurements();
      return;
    }
    void runMeasurements();
  }

  async function persistSettings(nextSettings: AppSettings) {
    const saved = await window.latencyMap.saveSettings(nextSettings);
    setSettings(saved);
    setSettingsOpen(false);
    pushRendererLog(
      'info',
      `Saved settings: rounds=${saved.rounds}, concurrency=${saved.concurrency}`
    );
  }

  async function saveCustomHost() {
    if (!hostEditor.name.trim() || !hostEditor.host.trim()) {
      return;
    }
    const saved = await window.latencyMap.upsertCustomHost({
      id: hostEditor.id ?? '',
      name: hostEditor.name.trim(),
      location: hostEditor.location.trim(),
      host: hostEditor.host.trim(),
      enabled: hostEditor.enabled,
    });

    setCustomHosts((current) => {
      const exists = current.some((host) => host.id === saved.id);
      return exists
        ? current.map((host) => (host.id === saved.id ? saved : host))
        : [...current, saved];
    });
    setHostEditor(EMPTY_EDITOR);
    setEditorOpen(false);
    pushRendererLog('info', `Saved custom host ${saved.name} (${saved.host})`);
  }

  async function removeCustomHost(id: string) {
    await window.latencyMap.deleteCustomHost(id);
    setCustomHosts((current) => current.filter((host) => host.id !== id));
    setDeleteTarget(null);
    pushRendererLog('warn', `Removed custom host ${id}`);
  }

  async function handleUpdateClick() {
    if (!updateStatus) return;
    if (updateStatus.status === 'downloaded' && updateStatus.autoInstallSupported) {
      await window.latencyMap.installDownloadedUpdate();
      return;
    }
    if (updateStatus.status === 'available' && !updateStatus.autoInstallSupported) {
      await window.latencyMap.openReleasesPage();
      return;
    }
    await window.latencyMap.checkForUpdates();
  }

  function toggleArrayValue(key: 'selectedContinents' | 'selectedCountries' | 'selectedCities', value: string) {
    setQuery((current) => {
      const nextValues = current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value];
      if (key === 'selectedContinents') {
        return {
          ...current,
          selectedContinents: nextValues,
          selectedCountries: current.selectedCountries.filter((country) =>
            getAvailableCountries(catalogHosts, nextValues).includes(country)
          ),
          selectedCities: current.selectedCities.filter((city) =>
            getAvailableCities(
              catalogHosts,
              current.selectedCountries.filter((country) =>
                getAvailableCountries(catalogHosts, nextValues).includes(country)
              )
            ).includes(city)
          ),
        };
      }
      if (key === 'selectedCountries') {
        return {
          ...current,
          selectedCountries: nextValues,
          selectedCities: current.selectedCities.filter((city) =>
            getAvailableCities(catalogHosts, nextValues).includes(city)
          ),
        };
      }
      return { ...current, selectedCities: nextValues };
    });
  }

  function toggleProvider(providerId: string) {
    setQuery((current) => ({
      ...current,
      selectedProviderIds: current.selectedProviderIds.includes(providerId)
        ? current.selectedProviderIds.filter((id) => id !== providerId)
        : [...current.selectedProviderIds, providerId],
    }));
  }

  function applyManualReference() {
    const latitude = Number(referenceDraft.latitude);
    const longitude = Number(referenceDraft.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setReferenceError('Enter a valid latitude and longitude.');
      return;
    }

    const manualLocation: UserReferenceLocation = {
      latitude,
      longitude,
      label: referenceDraft.label.trim() || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      source: 'manual',
    };
    setReferenceLocation(manualLocation);
    setReferenceError(null);
    pushRendererLog('info', `Reference location set manually: ${manualLocation.label}`);
  }

  if (!catalog) {
    return <div className="app-loading">Loading LatencyMap…</div>;
  }

  const visibleHosts =
    viewMode === 'custom' ? filteredCustomHosts : activeProviderId ? providerHosts : rankedHosts;
  const summary = summarizeHosts(visibleHosts);
  const hostMetricCount =
    viewMode === 'shares'
      ? filteredShareRecords.length
      : viewMode === 'custom'
      ? filteredCustomHosts.length
      : activeProviderId
        ? providerHosts.length
        : filteredCatalogHosts.length + (query.includeCustomHosts ? customDisplayHosts.length : 0);
  const shareDisabled = shareBusy || running || !batch?.results.length || visibleHosts.length === 0;

  return (
    <>
      <div className="shell">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-mark">
              <div className="logo-bars">
                <div className="lbar"></div>
                <div className="lbar"></div>
                <div className="lbar"></div>
                <div className="lbar"></div>
              </div>
            </div>
            <div className="sidebar-logo-text">LatencyMap</div>
          </div>
          <div className="sidebar-static">
            <div
              className={`nav-item ${viewMode === 'query' && !activeProviderId ? 'active' : ''}`}
              onClick={() => {
                setViewMode('query');
                setActiveProviderId(null);
              }}
            >
              <span className="nav-icon">◈</span>Query
            </div>
            <div
              className={`nav-item ${viewMode === 'custom' ? 'active' : ''}`}
              onClick={() => {
                setViewMode('custom');
                setActiveProviderId(null);
              }}
            >
              <span className="nav-icon">✦</span>Custom Hosts
            </div>
            <div
              className={`nav-item ${viewMode === 'shares' ? 'active' : ''}`}
              onClick={() => {
                setViewMode('shares');
                setActiveProviderId(null);
              }}
            >
              <span className="nav-icon">⇱</span>My Shares
            </div>
            <div className="sidebar-divider"></div>
            <div className="sidebar-section-label">Providers</div>
          </div>
          <div className="sidebar-provider-list">
            {sortedProviders.map((provider) => (
              <div
                key={provider.id}
                className={`nav-item ${activeProviderId === provider.id ? 'active' : ''}`}
                onClick={() => {
                  setViewMode('query');
                  setActiveProviderId(provider.id);
                }}
              >
                <span className="nav-icon">{provider.icon}</span>
                {provider.name}
              </div>
            ))}
          </div>
          <div className="sidebar-legend">
            <div className="legend-title">Latency Legend</div>
            <div className="legend-row">
              <div className="legend-dot good"></div>Good &lt;50ms
            </div>
            <div className="legend-row">
              <div className="legend-dot medium"></div>Medium 50-150ms
            </div>
            <div className="legend-row">
              <div className="legend-dot bad"></div>Poor &gt;150ms
            </div>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <div className="sb-item topbar-left">{formatAgo(batch?.completedAt ?? null)}</div>
            <div className="topbar-center">
              <div className="hud-stat">
                <div className="hud-label">Best</div>
                <div className="hud-val good-text">
                  {formatLatency(summary.best?.avgLatencyMs ?? null)}
                </div>
              </div>
              <div className="hud-sep"></div>
              <div className="hud-stat">
                <div className="hud-label">Average</div>
                <div className="hud-val">{formatLatency(summary.average)}</div>
              </div>
              <div className="hud-sep"></div>
              <div className="hud-stat">
                <div className="hud-label">Hosts</div>
                <div className="hud-val">{hostMetricCount}</div>
              </div>
              <div className="hud-sep"></div>
              <div className="hud-stat">
                <div className="hud-label">Worst</div>
                <div className="hud-val bad-text">
                  {formatLatency(summary.worst?.avgLatencyMs ?? null)}
                </div>
              </div>
            </div>
            <div className="topbar-right">
              <button
                className="gear-btn"
                onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                title="Toggle theme"
              >
                {theme === 'dark' ? '☀' : '🌙'}
              </button>
              <button className="gear-btn" onClick={() => setSettingsOpen(true)} title="Settings">
                ⚙
              </button>
            </div>
          </header>

          {viewMode === 'query' && !activeProviderId ? (
            <div className="view active">
              <div className="query-panel">
                {/* Row 1 — location filter */}
                <div className="qp-row">
                  <div className="qp-tabs">
                    <button
                      className={`qp-tab ${locationMode === 'locations' ? 'active' : ''}`}
                      onClick={() => {
                        setLocationMode('locations');
                        setQuery((q) => ({ ...q, distanceKm: null }));
                      }}
                    >
                      By locations
                    </button>
                    <button
                      className={`qp-tab ${locationMode === 'distance' ? 'active' : ''}`}
                      onClick={() => {
                        setLocationMode('distance');
                        setQuery((q) => ({ ...q, selectedContinents: [], selectedCountries: [], selectedCities: [] }));
                        if (!referenceLocation) void resolveReferenceLocation('ip');
                      }}
                    >
                      By distance
                    </button>
                  </div>

                  <div className="qp-rule" />

                  {locationMode === 'locations' ? (
                    <>
                      <div className="qp-dropdown">
                        <MultiSelectDropdown
                          values={continents}
                          selectedValues={query.selectedContinents}
                          onToggle={(value) => toggleArrayValue('selectedContinents', value)}
                          placeholder="Continents"
                        />
                      </div>
                      <div className="qp-dropdown">
                        <MultiSelectDropdown
                          values={countries}
                          selectedValues={query.selectedCountries}
                          disabled={query.selectedContinents.length === 0}
                          emptyLabel="Select a continent first."
                          onToggle={(value) => toggleArrayValue('selectedCountries', value)}
                          placeholder="Countries"
                        />
                      </div>
                      <div className="qp-dropdown">
                        <MultiSelectDropdown
                          values={cities}
                          selectedValues={query.selectedCities}
                          disabled={query.selectedCountries.length === 0}
                          emptyLabel="Select a country first."
                          onToggle={(value) => toggleArrayValue('selectedCities', value)}
                          placeholder="Cities"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="qp-ref-status">
                        <span className={`qp-ref-dot${referenceLocation ? ' live' : ''}`} />
                        <span className="qp-ref-text">
                          {referenceBusy ? 'Locating…' : referenceLocation ? referenceLocation.label : 'No location set'}
                        </span>
                      </div>
                      <button className="mini-btn" onClick={() => void resolveReferenceLocation('device')}>
                        Device
                      </button>
                      <button className="mini-btn" onClick={() => void resolveReferenceLocation('ip')}>
                        IP
                      </button>

                      <div className="qp-rule" />

                      <input
                        className="field-input qp-coord"
                        value={referenceDraft.latitude}
                        onChange={(event) =>
                          setReferenceDraft((c) => ({ ...c, latitude: event.target.value }))
                        }
                        placeholder="Latitude"
                      />
                      <input
                        className="field-input qp-coord"
                        value={referenceDraft.longitude}
                        onChange={(event) =>
                          setReferenceDraft((c) => ({ ...c, longitude: event.target.value }))
                        }
                        placeholder="Longitude"
                      />
                      <input
                        className="field-input qp-label-input"
                        value={referenceDraft.label}
                        onChange={(event) =>
                          setReferenceDraft((c) => ({ ...c, label: event.target.value }))
                        }
                        placeholder="Label (optional)"
                      />
                      <button className="mini-btn mini-btn-strong" onClick={applyManualReference}>
                        Apply
                      </button>

                      <div className="qp-rule" />

                      <input
                        className="field-input qp-radius"
                        type="number"
                        min="1"
                        placeholder="Radius km"
                        disabled={!referenceLocation}
                        value={query.distanceKm?.toString() ?? ''}
                        onChange={(event) =>
                          setQuery((current) => ({
                            ...current,
                            distanceKm: event.target.value ? Number(event.target.value) : null,
                          }))
                        }
                      />
                    </>
                  )}
                </div>

                {/* Row 2 — providers + run */}
                <div className="qp-row">
                  <div className="qp-dropdown">
                    <MultiSelectDropdown
                      values={sortedProviders.map((provider) => provider.name)}
                      selectedValues={sortedProviders
                        .filter((provider) => query.selectedProviderIds.includes(provider.id))
                        .map((provider) => provider.name)}
                      onToggle={(providerName) => {
                        const provider = sortedProviders.find((item) => item.name === providerName);
                        if (provider) {
                          toggleProvider(provider.id);
                        }
                      }}
                      placeholder="Providers"
                    />
                  </div>

                  <label className="qp-check">
                    <input
                      type="checkbox"
                      checked={query.includeCustomHosts}
                      onChange={(event) =>
                        setQuery((current) => ({
                          ...current,
                          includeCustomHosts: event.target.checked,
                        }))
                      }
                    />
                    <span>Custom hosts</span>
                  </label>

                  {referenceError && locationMode === 'distance' && (
                    <span className="qp-error">{referenceError}</span>
                  )}

                  <div className="qp-spacer" />

                  <button className="share-btn" disabled={shareDisabled} onClick={handleShareClick}>
                    {shareBusy ? '… SHARING' : '⇱ SHARE'}
                  </button>
                  <button className="rescan-btn" disabled={cancelling} onClick={handleRunButtonClick}>
                    {running ? (cancelling ? '… STOPPING' : '■ CANCEL') : '⟳ RUN'}
                  </button>
                </div>
              </div>

              <div className="table-scroll">
                <div className="provider-block">
                  <div className="provider-heading">
                    <span className="provider-icon">◈</span>
                    <span className="provider-label">Ranked Hosts</span>
                    <span className="provider-pill">{rankedHosts.length} nodes</span>
                  </div>
                  <table className="data-table ranked-table">
                    <thead>
                      <tr>
                        <th style={{ width: '12%' }}>Provider</th>
                        <th style={{ width: '13%' }}>City</th>
                        <th style={{ width: '11%' }}>Country</th>
                        <th style={{ width: '22%' }}>Hostname</th>
                        <th style={{ width: '9%' }}>Region</th>
                        <SortableHeader label="Distance" sortKey="distance" current={sort} onSort={setSort} style={{ width: '8%' }} />
                        <SortableHeader label="Latency" sortKey="latency" current={sort} onSort={setSort} style={{ width: '8%' }} />
                        <SortableHeader label="Hops" sortKey="hops" current={sort} onSort={setSort} style={{ width: '5%' }} />
                        <th style={{ width: '8%' }}>Quality</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedHosts.length === 0 ? (
                        <tr className="empty-row">
                          <td colSpan={10}>No hosts match the current query.</td>
                        </tr>
                      ) : (
                        rankedHosts.map((host, index) => (
                          <RankedHostRow
                            key={host.id}
                            host={host}
                            isOpen={expandedHostId === host.id}
                            isRunning={runningTargetIds.includes(host.id)}
                            onToggle={() =>
                              setExpandedHostId((current) => (current === host.id ? null : host.id))
                            }
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {error || shareError ? <div className="error-banner">{error ?? shareError}</div> : null}
              </div>

              <footer className="statusbar">
                <div className="sb-item">
                  <span>Best:</span>
                  <span className="sb-val good-text">
                    {summary.best
                      ? `${formatLatency(summary.best.avgLatencyMs)} · ${summary.best.targetHost}`
                      : '—'}
                  </span>
                </div>
                <div className="sb-sep"></div>
                <div className="sb-item">
                  <span>Avg:</span>
                  <span className="sb-val">{formatLatency(summary.average)}</span>
                </div>
                <div className="sb-sep"></div>
                <div className="sb-item">
                  <span className="good-text">●</span>
                  <span className="sb-val good-text">{summary.goodCount} good</span>
                </div>
                <div className="sb-item">
                  <span className="medium-text">●</span>
                  <span className="sb-val medium-text">{summary.mediumCount} medium</span>
                </div>
                <div className="sb-item">
                  <span className="bad-text">●</span>
                  <span className="sb-val bad-text">{summary.badCount} poor</span>
                </div>
              </footer>
            </div>
          ) : activeProvider ? (
            <div className="view active">
              <div className="table-scroll">
                <div className="provider-block">
                  <div className="provider-heading">
                    <span className="provider-icon">{activeProvider.icon}</span>
                    <span className="provider-label">{activeProvider.name}</span>
                    <span className="provider-pill">{providerHosts.length} nodes</span>
                    <div className="qp-spacer" />
                    <button className="share-btn" disabled={shareDisabled} onClick={handleShareClick}>
                      {shareBusy ? '… SHARING' : '⇱ SHARE'}
                    </button>
                    <button className="rescan-btn" disabled={cancelling} onClick={handleRunButtonClick}>
                      {running ? (cancelling ? '… STOPPING' : '■ CANCEL') : '⟳ RUN'}
                    </button>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '30%' }}>Location</th>
                        <th style={{ width: '30%' }}>Hostname</th>
                        <SortableHeader label="Latency" sortKey="latency" current={sort} onSort={setSort} style={{ width: '10%' }} />
                        <SortableHeader label="Hops" sortKey="hops" current={sort} onSort={setSort} style={{ width: '8%' }} />
                        <th style={{ width: '14%' }}>Quality</th>
                      </tr>
                    </thead>
                    <tbody>
                      {providerHosts.length === 0 ? (
                        <tr className="empty-row">
                          <td colSpan={6}>No hosts found for this provider.</td>
                        </tr>
                      ) : (
                        providerHosts.map((host, index) => (
                          <ProviderHostRow
                            key={host.id}
                            host={host}
                            isOpen={expandedHostId === host.id}
                            isRunning={runningTargetIds.includes(host.id)}
                            onToggle={() =>
                              setExpandedHostId((current) => (current === host.id ? null : host.id))
                            }
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {error || shareError ? <div className="error-banner">{error ?? shareError}</div> : null}
              </div>

              <footer className="statusbar">
                <div className="sb-item">
                  <span>Best:</span>
                  <span className="sb-val good-text">
                    {summary.best
                      ? `${formatLatency(summary.best.avgLatencyMs)} · ${summary.best.targetHost}`
                      : '—'}
                  </span>
                </div>
                <div className="sb-sep"></div>
                <div className="sb-item">
                  <span>Avg:</span>
                  <span className="sb-val">{formatLatency(summary.average)}</span>
                </div>
                <div className="sb-sep"></div>
                <div className="sb-item">
                  <span className="good-text">●</span>
                  <span className="sb-val good-text">{summary.goodCount} good</span>
                </div>
                <div className="sb-item">
                  <span className="medium-text">●</span>
                  <span className="sb-val medium-text">{summary.mediumCount} medium</span>
                </div>
                <div className="sb-item">
                  <span className="bad-text">●</span>
                  <span className="sb-val bad-text">{summary.badCount} poor</span>
                </div>
              </footer>
            </div>
          ) : viewMode === 'shares' ? (
            <div className="view active">
              <div className="ch-header">
                <div>
                  <div className="ch-title">My Shares</div>
                  <div className="ch-subtitle">
                    Links created from this machine for readonly published snapshots
                  </div>
                </div>
              </div>
              <div className="table-scroll">
                {filteredShareRecords.length === 0 ? (
                  <div className="ch-empty">
                    <div className="ch-empty-icon">⇱</div>
                    <div className="ch-empty-text">No shares yet</div>
                    <div className="ch-empty-sub">
                      Create a share from a completed measurement to manage it here
                    </div>
                  </div>
                ) : (
                  <div className="provider-block">
                    <div className="provider-heading">
                      <span className="provider-icon">⇱</span>
                      <span className="provider-label">Saved Shares</span>
                      <span className="provider-pill">{filteredShareRecords.length} links</span>
                    </div>
                    <table className="data-table shares-table">
                      <thead>
                        <tr>
                          <th style={{ width: '22%' }}>Created</th>
                          <th style={{ width: '44%' }}>URL</th>
                          <th style={{ width: '12%' }}>Scope</th>
                          <th style={{ width: '22%' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredShareRecords.map((share) => (
                          <tr className="host-row shares-row" key={share.publicId}>
                            <td>{new Date(share.createdAt).toLocaleString()}</td>
                            <td><span className="muted-inline share-link-text">{share.publicUrl}</span></td>
                            <td>{share.containsCustomHosts ? 'Custom' : 'Catalog'}</td>
                            <td>
                              <div className="row-actions">
                                <button
                                  className="btn-icon btn-icon-open"
                                  onClick={() => window.open(share.publicUrl, '_blank', 'noopener,noreferrer')}
                                  title="Open share"
                                >
                                  ↗
                                </button>
                                <button
                                  className="btn-icon btn-icon-copy"
                                  onClick={async () => {
                                    await navigator.clipboard.writeText(share.publicUrl);
                                    pushRendererLog('info', `Copied share URL ${share.publicId}`);
                                  }}
                                  title="Copy share URL"
                                >
                                  ⧉
                                </button>
                                <button
                                  className="btn-icon btn-icon-del"
                                  onClick={() => void handleDeleteShare(share)}
                                  title="Delete share"
                                >
                                  🗑
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {shareError ? <div className="error-banner">{shareError}</div> : null}
              </div>
              <footer className="statusbar">
                <div className="sb-item">
                  <span>{shareRecords.length}</span>
                  <span className="sb-val">shares stored locally</span>
                </div>
              </footer>
            </div>
          ) : (
            <div className="view active">
              <div className="ch-header">
                <div>
                  <div className="ch-title">Custom Hosts</div>
                  <div className="ch-subtitle">
                    Manually configured endpoints for latency monitoring
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button className="share-btn" disabled={shareDisabled} onClick={handleShareClick}>
                    {shareBusy ? '… SHARING' : '⇱ SHARE'}
                  </button>
                  <button className="rescan-btn" disabled={cancelling} onClick={handleRunButtonClick}>
                    {running ? (cancelling ? '… STOPPING' : '■ CANCEL') : '⟳ RUN'}
                  </button>
                  <button
                    className="btn-add"
                    onClick={() => {
                      setHostEditor(EMPTY_EDITOR);
                      setEditorOpen(true);
                    }}
                  >
                    <span className="btn-add-icon">+</span>Add Host
                  </button>
                </div>
              </div>
              <div className="table-scroll">
                {customHosts.length === 0 ? (
                  <div className="ch-empty">
                    <div className="ch-empty-icon">📡</div>
                    <div className="ch-empty-text">No custom hosts yet</div>
                    <div className="ch-empty-sub">
                      Click &quot;Add Host&quot; to monitor your own endpoints
                    </div>
                  </div>
                ) : (
                  <div className="provider-block">
                    <div className="provider-heading">
                      <span className="provider-icon">✦</span>
                      <span className="provider-label">Custom Hosts</span>
                      <span className="provider-pill">{filteredCustomHosts.length} nodes</span>
                    </div>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '28%' }}>Location</th>
                          <th style={{ width: '24%' }}>Hostname</th>
                          <SortableHeader label="Latency" sortKey="latency" current={sort} onSort={setSort} style={{ width: '9%' }} />
                          <SortableHeader label="Hops" sortKey="hops" current={sort} onSort={setSort} style={{ width: '6%' }} />
                          <th style={{ width: '14%' }}>Quality</th>
                          <th style={{ width: '11%' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCustomHosts.map((host, index) => (
                          <CustomHostRow
                            key={host.id}
                            host={host}
                            isOpen={expandedHostId === host.id}
                            isRunning={runningTargetIds.includes(host.id)}
                            onToggle={() =>
                              setExpandedHostId((current) => (current === host.id ? null : host.id))
                            }
                            trailingActions={
                              <div className="row-actions">
                                <button
                                  className="btn-icon btn-icon-edit"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    const customHost = customHosts.find((item) => item.id === host.id);
                                    if (!customHost) return;
                                    setHostEditor({
                                      id: customHost.id,
                                      name: customHost.name,
                                      location: customHost.location,
                                      host: customHost.host,
                                      enabled: customHost.enabled,
                                    });
                                    setEditorOpen(true);
                                  }}
                                >
                                  ✏
                                </button>
                                <button
                                  className="btn-icon btn-icon-del"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    const customHost = customHosts.find((item) => item.id === host.id);
                                    if (customHost) setDeleteTarget(customHost);
                                  }}
                                >
                                  🗑
                                </button>
                              </div>
                            }
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              {shareError ? <div className="error-banner">{shareError}</div> : null}
              <footer className="statusbar">
                <div className="sb-item">
                  <span>{customHosts.length}</span>
                  <span className="sb-val">custom hosts configured</span>
                </div>
              </footer>
            </div>
          )}
        </div>
      </div>
      <div className={`log-panel ${logsExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="log-panel-header">
          <div className="log-header-left">
            <button className="log-toggle" onClick={() => setLogsExpanded((value) => !value)}>
              {logsExpanded ? '▾ Hide Logs' : '▸ Show Logs'}
            </button>
            <button
              className="log-clear"
              onClick={async () => {
                const text = logs
                  .map(
                    (entry) =>
                      `${new Date(entry.timestamp).toLocaleTimeString()} [${entry.source}] ${entry.message}`
                  )
                  .join('\n');
                await navigator.clipboard.writeText(text);
              }}
            >
              Copy
            </button>
            <button
              className="log-clear"
              onClick={async () => {
                await window.latencyMap.clearLogs();
                setLogs([]);
              }}
            >
              Clear
            </button>
          </div>
          <button className="version-link log-version-link" onClick={() => void handleUpdateClick()}>
            {renderUpdateLabel(version, updateStatus)}
          </button>
        </div>
        {logsExpanded ? (
          <div className="log-panel-body" ref={logsBodyRef}>
            {logs.length === 0 ? (
              <div className="log-line muted">No logs yet.</div>
            ) : (
              logs.map((entry) => (
                <div className={`log-line log-${entry.level}`} key={entry.id}>
                  <span className="log-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  <span className="log-source">[{entry.source}]</span>
                  <span className="log-message">{entry.message}</span>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>

      {settingsOpen ? (
        <div className="modal-overlay open" onClick={() => setSettingsOpen(false)}>
          <div className="modal settings-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Settings</div>
              <button className="modal-close" onClick={() => setSettingsOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body settings-body">
              <div className="setting-row">
                <div className="setting-copy">
                  <div className="setting-label">Rounds per scan</div>
                  <div className="setting-hint">
                    Number of probes sent per host to calculate average latency
                  </div>
                </div>
                <div className="setting-control">
                  <div className="setting-current">{settings.rounds}</div>
                  <div className="stepper">
                    <button
                      className="stepper-btn"
                      onClick={() =>
                        setSettings((current) => ({
                          ...current,
                          rounds: Math.max(1, current.rounds - 1),
                        }))
                      }
                    >
                      −
                    </button>
                    <div className="stepper-val">{settings.rounds}</div>
                    <button
                      className="stepper-btn"
                      onClick={() =>
                        setSettings((current) => ({
                          ...current,
                          rounds: Math.min(20, current.rounds + 1),
                        }))
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <div className="setting-row">
                <div className="setting-copy">
                  <div className="setting-label">Parallel hosts</div>
                  <div className="setting-hint">
                    Maximum number of hosts verified at the same time
                  </div>
                </div>
                <div className="setting-control">
                  <div className="setting-current">{settings.concurrency}</div>
                  <div className="stepper">
                    <button
                      className="stepper-btn"
                      onClick={() =>
                        setSettings((current) => ({
                          ...current,
                          concurrency: Math.max(1, current.concurrency - 1),
                        }))
                      }
                    >
                      −
                    </button>
                    <div className="stepper-val">{settings.concurrency}</div>
                    <button
                      className="stepper-btn"
                      onClick={() =>
                        setSettings((current) => ({
                          ...current,
                          concurrency: Math.min(20, current.concurrency + 1),
                        }))
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <div className="settings-note">
                Higher parallelism speeds up full batches, but can add local network noise while testing.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setSettingsOpen(false)}>
                Close
              </button>
              <button className="btn-save" onClick={() => void persistSettings(settings)}>
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editorOpen ? (
        <div className="modal-overlay open" onClick={() => setEditorOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {hostEditor.id ? 'Edit Custom Host' : 'Add Custom Host'}
              </div>
              <button className="modal-close" onClick={() => setEditorOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="field">
                <div className="field-label">Name</div>
                <input
                  className="field-input"
                  value={hostEditor.name}
                  onChange={(event) =>
                    setHostEditor((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </div>
              <div className="field">
                <div className="field-label">Location</div>
                <input
                  className="field-input"
                  value={hostEditor.location}
                  onChange={(event) =>
                    setHostEditor((current) => ({ ...current, location: event.target.value }))
                  }
                />
              </div>
              <div className="field">
                <div className="field-label">Hostname</div>
                <input
                  className="field-input"
                  value={hostEditor.host}
                  onChange={(event) =>
                    setHostEditor((current) => ({ ...current, host: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setEditorOpen(false)}>
                Cancel
              </button>
              <button className="btn-save" onClick={() => void saveCustomHost()}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="modal-overlay open" onClick={() => setDeleteTarget(null)}>
          <div className="modal modal-confirm" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Remove Host</div>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>
                ✕
              </button>
            </div>
            <div className="confirm-body">
              <div className="confirm-icon">🗑</div>
              <div className="confirm-msg">Remove this custom host from LatencyMap?</div>
              <div className="confirm-host">{deleteTarget.name} · {deleteTarget.host}</div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="btn-delete" onClick={() => void removeCustomHost(deleteTarget.id)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shareWarningPayload ? (
        <div className="modal-overlay open" onClick={() => setShareWarningPayload(null)}>
          <div className="modal modal-confirm" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Share Custom Hosts</div>
              <button className="modal-close" onClick={() => setShareWarningPayload(null)}>
                ✕
              </button>
            </div>
            <div className="confirm-body">
              <div className="confirm-icon">⚠</div>
              <div className="confirm-msg">Custom hosts and traceroute hops may expose internal infrastructure.</div>
              <div className="confirm-sub">
                Anyone with the link can view these results, and shares do not expire automatically.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShareWarningPayload(null)}>
                Cancel
              </button>
              <button className="btn-save" disabled={shareBusy} onClick={() => void uploadShare(shareWarningPayload)}>
                Share Anyway
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shareSuccess ? (
        <div className="modal-overlay open" onClick={() => setShareSuccess(null)}>
          <div className="modal modal-confirm" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Share Created</div>
              <button className="modal-close" onClick={() => setShareSuccess(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body share-modal-body">
              <div className="field">
                <div className="field-label">Public URL</div>
                <input className="field-input" readOnly value={shareSuccess.publicUrl} />
              </div>
              <div className="share-modal-note">
                This snapshot is readonly and reflects the results collected on your machine at that moment.
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-cancel"
                onClick={async () => {
                  await navigator.clipboard.writeText(shareSuccess.publicUrl);
                }}
              >
                Copy Link
              </button>
              <button
                className="btn-delete"
                disabled={shareBusy}
                onClick={() =>
                  void handleDeleteShare({
                    publicId: shareSuccess.publicId,
                    deleteToken: shareSuccess.deleteToken,
                  })
                }
              >
                Delete Share
              </button>
              <button className="btn-save" onClick={() => setShareSuccess(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}


function MultiSelectDropdown({
  values,
  selectedValues,
  onToggle,
  disabled,
  emptyLabel,
  placeholder,
}: {
  values: string[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  disabled?: boolean;
  emptyLabel?: string;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  if (disabled) {
    return (
      <div className="multi-dropdown disabled">
        <button type="button" className="multi-trigger" disabled>
          <span className="multi-trigger-placeholder">{emptyLabel ?? 'Unavailable.'}</span>
          <span className="multi-trigger-caret">▾</span>
        </button>
      </div>
    );
  }

  if (values.length === 0) {
    return (
      <div className="multi-dropdown disabled">
        <button type="button" className="multi-trigger" disabled>
          <span className="multi-trigger-placeholder">No options available.</span>
          <span className="multi-trigger-caret">▾</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`multi-dropdown ${open ? 'open' : ''}`} ref={rootRef}>
      <button type="button" className="multi-trigger" onClick={() => setOpen((current) => !current)}>
        <span className="multi-trigger-values">
          {selectedValues.length === 0 ? (
            <span className="multi-trigger-placeholder">{placeholder}</span>
          ) : selectedValues.length === 1 ? (
            <span className="multi-chip">{selectedValues[0]}</span>
          ) : selectedValues.length === values.length ? (
            <span className="multi-trigger-placeholder">All {values.length} selected</span>
          ) : (
            <span className="multi-trigger-placeholder">{selectedValues.length} selected</span>
          )}
        </span>
        <span className="multi-trigger-caret">{open ? '▴' : '▾'}</span>
      </button>
      {open ? (
        <div className="multi-menu">
          {values.map((value) => {
            const selected = selectedValues.includes(value);
            return (
              <label key={value} className={`multi-menu-option ${selected ? 'selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggle(value)}
                />
                <span>{value}</span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function TracePanel({ host, colSpan }: { host: DisplayHost; colSpan: number }) {
  const result = host.result;
  return (
    <tr className="trace-row open">
      <td colSpan={colSpan}>
        <div className="trace-panel expanded">
          <div className="trace-inner">
            <div className="trace-heading">
              <span className="trace-heading-label">Traceroute</span>
              <span className="trace-heading-target">{host.hostname}</span>
              <div className="trace-heading-line"></div>
              <button
                className="trace-copy"
                onClick={async (event) => {
                  event.stopPropagation();
                  await navigator.clipboard.writeText(formatTracerouteText(host));
                }}
              >
                Copy
              </button>
              <span className="trace-meta">
                {result?.hopCount ?? 0} hops · {result?.hops.filter((hop) => !hop.timedOut).length ?? 0} responding
              </span>
            </div>
            <div className="trace-hops">
              {result?.hops.length ? (
                result.hops.map((hop, index) => {
                  const dotClass = hop.timedOut
                    ? 'hop-dot-timeout'
                    : hop.avgRttMs !== null && hop.avgRttMs < 50
                      ? 'hop-dot-good'
                      : hop.avgRttMs !== null && hop.avgRttMs < 150
                        ? 'hop-dot-medium'
                        : 'hop-dot-bad';
                  const previous = result.hops[index - 1]?.avgRttMs ?? 0;
                  const delta = hop.avgRttMs === null ? null : Math.round(hop.avgRttMs - previous);

                  return (
                    <div className="trace-hop" key={`${host.id}-${hop.hop}`}>
                      <span className="hop-num">{hop.hop}</span>
                      <div className="hop-connector">
                        <div className={`hop-dot ${dotClass}`}></div>
                        {index < result.hops.length - 1 ? <div className="hop-line"></div> : null}
                      </div>
                      <span className={`hop-host ${hop.timedOut ? 'hop-host-timeout' : ''}`}>
                        {hop.timedOut ? 'Request timeout' : hop.hostname ?? hop.ipAddress ?? 'Unknown hop'}
                      </span>
                      <span className="hop-ip">{hop.ipAddress ?? ''}</span>
                      <span className={`hop-rtt ${hop.timedOut ? 'hop-rtt-timeout' : ''}`}>
                        {hop.avgRttMs === null ? '* * *' : `${Math.round(hop.avgRttMs)}ms`}
                      </span>
                      <span className={`hop-delta ${delta !== null && delta > 30 ? 'hop-delta-high' : ''}`}>
                        {delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta}ms`}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="trace-empty">Run a measurement to inspect hop details.</div>
              )}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

function RankedHostRow({
  host,
  isOpen,
  isRunning,
  onToggle,
}: {
  host: DisplayHost;
  isOpen: boolean;
  isRunning: boolean;
  onToggle: () => void;
}) {
  const result = host.result;
  const score = result?.qualityScore ?? 0;
  return (
    <>
      <tr className={`host-row ${isOpen ? 'open' : ''} `} onClick={onToggle}>
        <td>
          <span className="row-chevron">{isOpen ? '▼' : '▶'}</span>
          <span className="muted-inline">{host.providerName}</span>
        </td>
        <td>{host.city}</td>
        <td>{host.country}</td>
        <td><span className="muted-inline">{host.hostname}</span></td>
        <td>{host.regionLabel}</td>
        <td>{formatDistance(host.distanceKm)}</td>
        <td>
          <span className={`lat ${isRunning ? 'lat-running' : result?.status === 'good' ? 'lat-good' : result?.status === 'medium' ? 'lat-medium' : 'lat-bad'}`}>
            {isRunning ? 'running...' : formatLatency(result?.avgLatencyMs ?? null)}
          </span>
        </td>
        <td><span className="hops-val">{result?.hopCount ?? '—'}</span></td>
        <td>
          <div className="q-track"><div className={`q-fill ${getQualityClass(score)}`} style={{ width: getQualityWidth(score) }}></div></div>
        </td>
      </tr>
      {isOpen ? <TracePanel host={host} colSpan={9} /> : null}
    </>
  );
}

function ProviderHostRow({
  host,
  isOpen,
  isRunning,
  onToggle,
}: {
  host: DisplayHost;
  isOpen: boolean;
  isRunning: boolean;
  onToggle: () => void;
}) {
  const result = host.result;
  const score = result?.qualityScore ?? 0;

  return (
    <>
      <tr className={`host-row ${isOpen ? 'open' : ''} `} onClick={onToggle}>
        <td>
          <span className="row-chevron">{isOpen ? '▼' : '▶'}</span>
          <span className="loc-name">{host.city}</span>
          <div className="loc-host">
            {[host.country, host.regionLabel].filter(Boolean).join(' · ')}
          </div>
        </td>
        <td>
          <span className="muted-inline">{host.hostname}</span>
        </td>
        <td>
          <span
            className={`lat ${isRunning ? 'lat-running' : result?.status === 'good' ? 'lat-good' : result?.status === 'medium' ? 'lat-medium' : 'lat-bad'}`}
          >
            {isRunning ? 'running...' : formatLatency(result?.avgLatencyMs ?? null)}
          </span>
        </td>
        <td>
          <span className="hops-val">{result?.hopCount ?? '—'}</span>
        </td>
        <td>
          <div className="q-track">
            <div className={`q-fill ${getQualityClass(score)}`} style={{ width: getQualityWidth(score) }}></div>
          </div>
        </td>
      </tr>
      {isOpen ? <TracePanel host={host} colSpan={5} /> : null}
    </>
  );
}

function CustomHostRow({
  host,
  isOpen,
  isRunning,
  onToggle,
  trailingActions,
}: {
  host: DisplayHost;
  isOpen: boolean;
  isRunning: boolean;
  onToggle: () => void;
  trailingActions?: ReactNode;
}) {
  const result = host.result;
  const score = result?.qualityScore ?? 0;
  return (
    <>
      <tr className={`host-row ${isOpen ? 'open' : ''} `} onClick={onToggle}>
        <td>
          <span className="row-chevron">{isOpen ? '▼' : '▶'}</span>
          <span className="loc-name">{host.location}</span>
          <div className="loc-host">{host.regionLabel}</div>
        </td>
        <td><span className="muted-inline">{host.hostname}</span></td>
        <td>
          <span className={`lat ${isRunning ? 'lat-running' : result?.status === 'good' ? 'lat-good' : result?.status === 'medium' ? 'lat-medium' : 'lat-bad'}`}>
            {isRunning ? 'running...' : formatLatency(result?.avgLatencyMs ?? null)}
          </span>
        </td>
        <td><span className="hops-val">{result?.hopCount ?? '—'}</span></td>
        <td>
          <div className="q-track">
            <div className={`q-fill ${getQualityClass(score)}`} style={{ width: getQualityWidth(score) }}></div>
          </div>
        </td>
        <td>{trailingActions ?? null}</td>
      </tr>
      {isOpen ? <TracePanel host={host} colSpan={6} /> : null}
    </>
  );
}

function renderUpdateLabel(version: string, status: UpdateStatus | null): string {
  if (!status) return `LatencyMap v${version}`;
  switch (status.status) {
    case 'available':
      return status.autoInstallSupported
        ? `LatencyMap v${version} · Update ${status.latestVersion}`
        : `LatencyMap v${version} · Release ${status.latestVersion}`;
    case 'downloading':
      return `LatencyMap v${version} · ${Math.round(status.downloadProgress ?? 0)}%`;
    case 'downloaded':
      return `LatencyMap v${version} · Restart to update`;
    case 'checking':
      return `LatencyMap v${version} · Checking…`;
    case 'error':
      return `LatencyMap v${version} · Update error`;
    default:
      return `LatencyMap v${version}`;
  }
}

export default App;
