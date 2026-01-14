/**
 * Core Logger - Placeholder for Phase 1
 *
 * This file will contain the main LoggerCore class.
 * Currently exports a minimal stub to make TypeScript happy.
 */

import type { LogEvent, LoggerConfig, LogSubscriber, Unsubscribe } from './types';

// Placeholder - will be implemented in Phase 1
class LoggerCore {
  info(_message: string, ..._data: unknown[]): void {
    // TODO: Implement in Phase 1
  }

  warn(_message: string, ..._data: unknown[]): void {
    // TODO: Implement in Phase 1
  }

  error(_message: string, ..._data: unknown[]): void {
    // TODO: Implement in Phase 1
  }

  debug(_message: string, ..._data: unknown[]): void {
    // TODO: Implement in Phase 1
  }

  configure(_config: Partial<LoggerConfig>): void {
    // TODO: Implement in Phase 1
  }

  clear(): void {
    // TODO: Implement in Phase 1
  }

  getLogs(): readonly LogEvent[] {
    // TODO: Implement in Phase 1
    return [];
  }

  subscribe(_fn: LogSubscriber): Unsubscribe {
    // TODO: Implement in Phase 1
    return () => {};
  }
}

// Singleton export
export const logger = new LoggerCore();
