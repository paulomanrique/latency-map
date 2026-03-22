/// <reference types="vite/client" />

import type { LatencyMapApi } from '../../shared/types';

declare global {
  interface Window {
    latencyMap: LatencyMapApi;
  }
}

export {};
