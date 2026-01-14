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

export const logger = {
  info: noop,
  warn: noop,
  error: noop,
  debug: noop,
  configure: noop,
  clear: noop,
  getLogs: () => [] as const,
  subscribe: () => noop,
  getSessionId: () => '',
  getConfig: () => ({ maxLogs: 1000, persist: false, minLevel: 'debug' as const, enabled: false }),
};

export const DevLoggerUI = {
  init: noop,
  open: noop,
  close: noop,
  toggle: noop,
  popout: noop,
  closePopout: noop,
  isPopoutOpen: () => false,
  destroy: noop,
  isVisible: () => false,
  isInitialized: () => false,
};

export const VERSION = '0.1.0';

// Types are still exported for type-checking
export type { LogEvent, LogLevel, LoggerConfig, Source } from './core/types';
