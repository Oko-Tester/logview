/**
 * DevLogger - No-Op Export for Production
 *
 * Import this instead of the main export in production builds
 * to completely eliminate logging code via tree-shaking.
 *
 * Usage in vite.config.ts:
 * ```ts
 * resolve: {
 *   alias: {
 *     'devlogger': process.env.NODE_ENV === 'production'
 *       ? 'devlogger/noop'
 *       : 'devlogger'
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

// No-op logger that does nothing
const noop = () => {};
const noopAsync = async () => false;

// No-op span
const noopSpan = {
  id: '',
  event: {} as never,
  ended: true,
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  span: () => noopSpan,
  end: noop,
  fail: noop,
};

// No-op context logger
const noopContextLogger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  span: () => noopSpan,
  withContext: () => noopContextLogger,
};

export const logger = {
  info: noop,
  warn: noop,
  error: noop,
  debug: noop,
  configure: noop,
  clear: noop,
  importLogs: noop,
  getLogs: () => [] as const,
  subscribe: () => noop,
  getSessionId: () => '',
  getConfig: () => ({ maxLogs: 1000, persist: false, minLevel: 'debug' as const, enabled: false }),
  // Span API
  span: () => noopSpan,
  getSpans: () => [] as const,
  getSpan: () => undefined,
  getSpanLogs: () => [] as const,
  subscribeSpans: () => noop,
  // Context API
  setGlobalContext: noop,
  updateGlobalContext: noop,
  getGlobalContext: () => ({}),
  clearGlobalContext: noop,
  withContext: () => noopContextLogger,
  // Export API
  exportLogs: () => '[]',
  copyLogs: noopAsync,
};

export const DevLoggerUI = {
  init: noop,
  open: noop,
  close: noop,
  toggle: noop,
  popout: noop,
  closePopout: noop,
  isPopoutOpen: () => false,
  setFilter: noop,
  getFilter: () => ({ levels: new Set(['debug', 'info', 'warn', 'error'] as const), search: '', file: '' }),
  clearFilter: noop,
  destroy: noop,
  isVisible: () => false,
  isInitialized: () => false,
};

export const ErrorCapture = {
  install: noop,
  uninstall: noop,
  isActive: () => false,
  getConfig: () => ({
    captureErrors: false,
    captureRejections: false,
    errorPrefix: '[Uncaught Error]',
    rejectionPrefix: '[Unhandled Rejection]',
  }),
};

export const LogPersistence = {
  enable: noop,
  disable: noop,
  isActive: () => false,
  hadCrash: () => false,
  getPersistedLogs: () => [] as const,
  rehydrate: () => 0,
  clear: noop,
  getConfig: () => ({
    storage: 'session' as const,
    maxPersisted: 500,
    debounceMs: 100,
  }),
};

export const VERSION = '0.1.0';

// Types are still exported for type-checking
export type {
  LogEvent,
  LogLevel,
  LoggerConfig,
  Source,
  LogSubscriber,
  SpanSubscriber,
  Unsubscribe,
  LogContext,
  SpanEvent,
  SpanStatus,
} from './core/types';
export type { FilterState } from './ui/filter';
export type { ErrorCaptureConfig } from './core/error-capture';
export type { PersistenceConfig } from './core/persistence';
export type { ExportOptions, LogSpan, ContextLogger } from './core/logger';
