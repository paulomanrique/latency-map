import { BrowserWindow } from 'electron';
import type { LogEntry } from '../shared/types';

const LOG_LIMIT = 500;
const entries: LogEntry[] = [];

function broadcast(entry: LogEntry): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('logs:entry', entry);
  }
}

export function writeLog(
  source: LogEntry['source'],
  level: LogEntry['level'],
  message: string
): LogEntry {
  const entry: LogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    source,
    level,
    message,
  };

  entries.push(entry);
  if (entries.length > LOG_LIMIT) {
    entries.splice(0, entries.length - LOG_LIMIT);
  }

  broadcast(entry);
  return entry;
}

export function getLogs(): LogEntry[] {
  return [...entries];
}

export function clearLogs(): void {
  entries.splice(0, entries.length);
}
