/**
 * DevLogger - Browser-based Dev Logger with UI
 *
 * @packageDocumentation
 */

// Core exports (Phase 1-3)
export { logger } from './core/logger';
export type { LogEvent, LogLevel, LoggerConfig, Source } from './core/types';

// UI exports (Phase 4-5)
export { DevLoggerUI } from './ui/overlay';

// Version info
export const VERSION = '0.1.0';
