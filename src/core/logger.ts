/**
 * Core Logger - Phase 1 Implementation
 *
 * Single Source of Truth for all logging operations.
 * UI-agnostic, crash-resistant, zero external dependencies.
 */

import type {
  LogEvent,
  LogLevel,
  LoggerConfig,
  LogSubscriber,
  Unsubscribe,
  Source,
} from './types';
import { LOG_LEVEL_VALUES } from './types';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<LoggerConfig> = {
  maxLogs: 1000,
  persist: false,
  minLevel: 'debug',
  enabled: true,
};

/**
 * Generate a unique session ID for this browser session
 */
function generateSessionId(): string {
  // Check for existing session ID in sessionStorage
  const STORAGE_KEY = 'devlogger_session_id';
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing) {
      return existing;
    }
    const newId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(STORAGE_KEY, newId);
    return newId;
  } catch {
    // sessionStorage not available, generate ephemeral ID
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

/**
 * Generate a unique log ID
 */
function generateLogId(): string {
  return `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Capture source location from stack trace
 * (Basic implementation - will be enhanced in Phase 2)
 */
function captureSource(): Source {
  try {
    const stack = new Error().stack;
    if (!stack) {
      return { file: 'unknown', line: 0 };
    }

    const lines = stack.split('\n');
    // Find the first stack frame that's not from this file
    // Skip: Error, captureSource, log, info/warn/error/debug
    for (let i = 4; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // Skip internal logger frames
      if (line.includes('logger.ts') || line.includes('logger.js')) {
        continue;
      }

      // Parse stack frame - handles various formats:
      // Chrome/Edge: "    at functionName (file:line:col)"
      // Firefox: "functionName@file:line:col"
      // Safari: "functionName@file:line:col"

      // Try Chrome/Edge format first
      const chromeMatch = line.match(/at\s+(?:(.+?)\s+)?\(?(.+?):(\d+):(\d+)\)?/);
      if (chromeMatch) {
        return {
          function: chromeMatch[1] || undefined,
          file: cleanFilePath(chromeMatch[2] || 'unknown'),
          line: parseInt(chromeMatch[3] || '0', 10),
          column: parseInt(chromeMatch[4] || '0', 10),
        };
      }

      // Try Firefox/Safari format
      const firefoxMatch = line.match(/(.+)?@(.+?):(\d+):(\d+)/);
      if (firefoxMatch) {
        return {
          function: firefoxMatch[1] || undefined,
          file: cleanFilePath(firefoxMatch[2] || 'unknown'),
          line: parseInt(firefoxMatch[3] || '0', 10),
          column: parseInt(firefoxMatch[4] || '0', 10),
        };
      }
    }

    return { file: 'unknown', line: 0 };
  } catch {
    return { file: 'unknown', line: 0 };
  }
}

/**
 * Clean up file path for display
 */
function cleanFilePath(path: string): string {
  // Remove webpack/vite internal prefixes
  let cleaned = path
    .replace(/^webpack:\/\/[^/]*\//, '')
    .replace(/^\/@fs/, '')
    .replace(/^file:\/\//, '')
    .replace(/\?.*$/, ''); // Remove query strings

  // Extract just the filename with one parent dir for context
  const parts = cleaned.split('/');
  if (parts.length > 2) {
    cleaned = parts.slice(-2).join('/');
  }

  return cleaned;
}

/**
 * Core Logger Class
 *
 * Lifecycle of a log:
 * 1. Log is created (info/warn/error/debug called)
 * 2. Log is enriched (timestamp, source, sessionId added)
 * 3. Log is stored (in-memory, with rotation)
 * 4. Log is distributed (subscribers notified)
 * 5. Log is displayed (by UI subscribers)
 */
class LoggerCore {
  private logs: LogEvent[] = [];
  private subscribers: Set<LogSubscriber> = new Set();
  private config: Required<LoggerConfig> = { ...DEFAULT_CONFIG };
  private sessionId: string;

  constructor() {
    this.sessionId = generateSessionId();
  }

  /**
   * Core logging method - all public methods delegate to this
   */
  private log(level: LogLevel, message: string, data: unknown[]): void {
    // Zero-Throw Policy: wrap everything in try-catch
    try {
      // Check if logging is enabled
      if (!this.config.enabled) {
        return;
      }

      // Check minimum log level
      if (LOG_LEVEL_VALUES[level] < LOG_LEVEL_VALUES[this.config.minLevel]) {
        return;
      }

      // Step 1 & 2: Create and enrich log event
      const event: LogEvent = {
        id: generateLogId(),
        timestamp: Date.now(),
        level,
        message: String(message),
        data: this.safeCloneData(data),
        source: captureSource(),
        sessionId: this.sessionId,
      };

      // Step 3: Store with rotation
      this.store(event);

      // Step 4: Distribute to subscribers
      this.notify(event);
    } catch (e) {
      // Silent fail - never throw from logger
      // Optionally log to console for debugging the debugger
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[DevLogger] Internal error:', e);
      }
    }
  }

  /**
   * Safely clone data to prevent mutations and handle special cases
   */
  private safeCloneData(data: unknown[]): unknown[] {
    return data.map((item) => this.safeClone(item));
  }

  /**
   * Deep clone with circular reference handling
   */
  private safeClone(value: unknown, seen = new WeakSet()): unknown {
    // Primitives
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value !== 'object') {
      return value;
    }

    // Handle Error objects specially
    if (value instanceof Error) {
      return {
        __type: 'Error',
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }

    // Handle Date
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }

    // Handle RegExp
    if (value instanceof RegExp) {
      return { __type: 'RegExp', value: value.toString() };
    }

    // Circular reference check
    if (seen.has(value as object)) {
      return '[Circular Reference]';
    }
    seen.add(value as object);

    // Handle Arrays
    if (Array.isArray(value)) {
      return value.map((item) => this.safeClone(item, seen));
    }

    // Handle plain objects
    try {
      const cloned: Record<string, unknown> = {};
      for (const key of Object.keys(value as object)) {
        cloned[key] = this.safeClone((value as Record<string, unknown>)[key], seen);
      }
      return cloned;
    } catch {
      return '[Uncloneable Object]';
    }
  }

  /**
   * Store log with FIFO rotation
   */
  private store(event: LogEvent): void {
    this.logs.push(event);

    // FIFO rotation - remove oldest logs if over limit
    while (this.logs.length > this.config.maxLogs) {
      this.logs.shift();
    }
  }

  /**
   * Notify all subscribers of new log
   */
  private notify(event: LogEvent): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event);
      } catch {
        // Don't let subscriber errors break logging
      }
    }
  }

  // ========== Public API ==========

  /**
   * Log an info message
   */
  info(message: string, ...data: unknown[]): void {
    this.log('info', message, data);
  }

  /**
   * Log a warning message
   */
  warn(message: string, ...data: unknown[]): void {
    this.log('warn', message, data);
  }

  /**
   * Log an error message
   */
  error(message: string, ...data: unknown[]): void {
    this.log('error', message, data);
  }

  /**
   * Log a debug message
   */
  debug(message: string, ...data: unknown[]): void {
    this.log('debug', message, data);
  }

  /**
   * Update logger configuration
   */
  configure(config: Partial<LoggerConfig>): void {
    try {
      this.config = { ...this.config, ...config };
    } catch {
      // Silent fail
    }
  }

  /**
   * Clear all stored logs
   */
  clear(): void {
    try {
      this.logs = [];
    } catch {
      // Silent fail
    }
  }

  /**
   * Import logs (used for rehydration from persistence)
   * Imported logs are added at the beginning, preserving order
   */
  importLogs(logs: LogEvent[]): void {
    try {
      if (!Array.isArray(logs) || logs.length === 0) {
        return;
      }

      // Filter out logs that already exist (by id)
      const existingIds = new Set(this.logs.map((l) => l.id));
      const newLogs = logs.filter((l) => !existingIds.has(l.id));

      // Prepend imported logs
      this.logs = [...newLogs, ...this.logs];

      // Apply rotation
      while (this.logs.length > this.config.maxLogs) {
        this.logs.shift();
      }
    } catch {
      // Silent fail
    }
  }

  /**
   * Get all stored logs (readonly)
   */
  getLogs(): readonly LogEvent[] {
    return this.logs;
  }

  /**
   * Subscribe to new log events
   */
  subscribe(fn: LogSubscriber): Unsubscribe {
    try {
      this.subscribers.add(fn);
      return () => {
        this.subscribers.delete(fn);
      };
    } catch {
      return () => {};
    }
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<LoggerConfig>> {
    return { ...this.config };
  }
}

// Singleton export
export const logger = new LoggerCore();
