/**
 * Core type definitions for DevLogger
 *
 * These types define the contract for all logging operations.
 * They are stable and should not change without major version bump.
 */

/**
 * Available log levels in order of severity
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Source location of a log entry
 */
export interface Source {
  /** File path or name */
  file: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based, optional) */
  column?: number;
  /** Function or method name (optional) */
  function?: string;
}

/**
 * A single log event with all metadata
 */
export interface LogEvent {
  /** Unique identifier for this log entry */
  id: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Log severity level */
  level: LogLevel;
  /** Primary log message */
  message: string;
  /** Additional data passed to the log call */
  data: unknown[];
  /** Source code location */
  source: Source;
  /** Browser session identifier */
  sessionId: string;
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** Maximum number of logs to keep in memory (default: 1000) */
  maxLogs?: number;
  /** Persist logs to sessionStorage (default: false) */
  persist?: boolean;
  /** Minimum log level to capture (default: 'debug') */
  minLevel?: LogLevel;
  /** Enable/disable logging entirely (default: true) */
  enabled?: boolean;
}

/**
 * Subscriber callback for new log events
 */
export type LogSubscriber = (event: LogEvent) => void;

/**
 * Function to unsubscribe from log events
 */
export type Unsubscribe = () => void;

/**
 * Log level numeric values for comparison
 */
export const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};
