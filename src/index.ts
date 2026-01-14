/**
 * DevLogger - Browser-based Dev Logger with UI
 *
 * A lightweight, framework-agnostic dev logger with a beautiful debug UI.
 * Zero dependencies, zero production overhead (via tree-shaking).
 *
 * @example
 * ```typescript
 * import { logger, DevLoggerUI } from 'devlogger';
 *
 * DevLoggerUI.init();
 * logger.info('App started');
 * logger.debug('Config loaded', { theme: 'dark' });
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// Core Logger API
// ============================================================================

/**
 * The logger singleton instance.
 *
 * @example
 * ```typescript
 * logger.info('User logged in', { userId: 123 });
 * logger.warn('Cache miss');
 * logger.error('API failed', new Error('Timeout'));
 * logger.debug('Rendering component', props);
 * ```
 */
export { logger } from './core/logger';

/**
 * Core type definitions for log events and configuration.
 */
export type {
  /** A single log event with all metadata */
  LogEvent,
  /** Log severity level: 'debug' | 'info' | 'warn' | 'error' */
  LogLevel,
  /** Logger configuration options */
  LoggerConfig,
  /** Source code location (file, line, column, function) */
  Source,
  /** Callback function for log subscriptions */
  LogSubscriber,
  /** Function to unsubscribe from log events */
  Unsubscribe,
} from './core/types';

// ============================================================================
// Debug UI API
// ============================================================================

/**
 * The DevLogger UI overlay controller.
 *
 * @example
 * ```typescript
 * // Initialize at app start
 * DevLoggerUI.init();
 *
 * // Toggle with code or Ctrl+Shift+L
 * DevLoggerUI.toggle();
 *
 * // Open in separate window
 * DevLoggerUI.popout();
 * ```
 */
export { DevLoggerUI } from './ui/overlay';

/**
 * Filter state type for programmatic filter control.
 */
export type { FilterState } from './ui/filter';

// ============================================================================
// Package Info
// ============================================================================

/** Current package version */
export const VERSION = '0.1.0';
