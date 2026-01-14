# DevLogger

A lightweight, browser-based dev logger with a beautiful debug UI. Zero dependencies, framework-agnostic, production-safe.

## Features

- 📋 **Structured Logging** - Replace `console.log` with type-safe, structured logs
- 🔍 **Source Location** - Automatic file, line, and function tracking
- 🎨 **Debug UI** - Shadow DOM overlay with filter, search, and pop-out window
- 🚀 **Zero Production Overhead** - Tree-shakeable no-op export for production builds
- 🔒 **Crash-Resistant** - Never throws, never breaks your app
- ⚡ **Global Error Capture** - Automatically catch uncaught errors and unhandled rejections
- 🌐 **Framework-Agnostic** - Works with React, Vue, Svelte, vanilla JS, or any framework

## Installation

```bash
npm install devlogger
```

## Quick Start

```typescript
import { logger, DevLoggerUI } from 'devlogger';

// Initialize the UI (once, at app start)
DevLoggerUI.init();

// Log messages with automatic source tracking
logger.info('App started');
logger.debug('Loading config', { theme: 'dark' });
logger.warn('Cache miss', { key: 'user_prefs' });
logger.error('API failed', new Error('Network timeout'));
```

## API Reference

### Logger

The `logger` singleton provides four log levels:

```typescript
// Debug - verbose development info
logger.debug(message: string, ...data: unknown[]): void

// Info - general information
logger.info(message: string, ...data: unknown[]): void

// Warning - potential issues
logger.warn(message: string, ...data: unknown[]): void

// Error - errors and exceptions
logger.error(message: string, ...data: unknown[]): void
```

#### Configuration

```typescript
logger.configure({
  maxLogs: 1000,      // Max logs in memory (FIFO rotation)
  minLevel: 'debug',  // Minimum level: 'debug' | 'info' | 'warn' | 'error'
  enabled: true,      // Enable/disable logging
  persist: false,     // Reserved for future persistence feature
});
```

#### Other Methods

```typescript
// Get all logs (readonly array)
const logs = logger.getLogs();

// Clear all logs
logger.clear();

// Subscribe to new logs
const unsubscribe = logger.subscribe((log: LogEvent) => {
  console.log('New log:', log);
});
unsubscribe(); // Stop receiving logs

// Get current session ID
const sessionId = logger.getSessionId();

// Get current config
const config = logger.getConfig();
```

### DevLoggerUI

The UI overlay provides a visual interface for viewing logs:

```typescript
// Initialize (creates Shadow DOM host)
DevLoggerUI.init();

// Show/hide panel
DevLoggerUI.open();
DevLoggerUI.close();
DevLoggerUI.toggle();

// Open in separate window
DevLoggerUI.popout();
DevLoggerUI.closePopout();
DevLoggerUI.isPopoutOpen();

// Filter logs programmatically
DevLoggerUI.setFilter({
  levels: new Set(['warn', 'error']),  // Show only warnings and errors
  search: 'api',                        // Text search
  file: 'utils',                        // Filter by file name
});
DevLoggerUI.getFilter();
DevLoggerUI.clearFilter();

// Cleanup
DevLoggerUI.destroy();

// State checks
DevLoggerUI.isVisible();
DevLoggerUI.isInitialized();
```

### Keyboard Shortcut

Press `Ctrl+Shift+L` to toggle the debug panel.

### ErrorCapture

Automatically capture uncaught errors and unhandled promise rejections:

```typescript
import { ErrorCapture } from 'devlogger';

// Install at app start
ErrorCapture.install();

// With custom configuration
ErrorCapture.install({
  captureErrors: true,       // Capture window.onerror (default: true)
  captureRejections: true,   // Capture unhandledrejection (default: true)
  errorPrefix: '[ERROR]',    // Prefix for error messages
  rejectionPrefix: '[REJECT]' // Prefix for rejection messages
});

// Check if active
ErrorCapture.isActive();

// Get current config
ErrorCapture.getConfig();

// Uninstall and restore original handlers
ErrorCapture.uninstall();
```

All captured errors are automatically logged as `error` level with full stack traces.

## Production Build

For production, import from `devlogger/noop` to completely eliminate logging code via tree-shaking:

### Vite

```typescript
// vite.config.ts
export default defineConfig({
  resolve: {
    alias: {
      'devlogger': process.env.NODE_ENV === 'production'
        ? 'devlogger/noop'
        : 'devlogger'
    }
  }
});
```

### Webpack

```javascript
// webpack.config.js
module.exports = {
  resolve: {
    alias: {
      'devlogger': process.env.NODE_ENV === 'production'
        ? 'devlogger/noop'
        : 'devlogger'
    }
  }
};
```

### esbuild

```javascript
// build.js
require('esbuild').build({
  alias: {
    'devlogger': process.env.NODE_ENV === 'production'
      ? 'devlogger/noop'
      : 'devlogger'
  }
});
```

The `noop` export provides the same API but all functions are no-ops, resulting in zero runtime overhead after tree-shaking.

## Types

```typescript
import type { LogEvent, LogLevel, LoggerConfig, Source, FilterState, ErrorCaptureConfig } from 'devlogger';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Source {
  file: string;
  line: number;
  column?: number;
  function?: string;
}

interface LogEvent {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  data: unknown[];
  source: Source;
  sessionId: string;
}

interface LoggerConfig {
  maxLogs?: number;
  persist?: boolean;
  minLevel?: LogLevel;
  enabled?: boolean;
}

interface FilterState {
  levels: Set<LogLevel>;
  search: string;
  file: string;
}

interface ErrorCaptureConfig {
  captureErrors?: boolean;
  captureRejections?: boolean;
  errorPrefix?: string;
  rejectionPrefix?: string;
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Your Application                        │
│                                                              │
│   logger.info('message', data)  ───────────────────────┐    │
│                                                         │    │
└─────────────────────────────────────────────────────────│────┘
                                                          │
┌─────────────────────────────────────────────────────────▼────┐
│                     LoggerCore (Singleton)                    │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Capture  │──│ Enrich   │──│  Store   │──│  Notify  │    │
│  │ Source   │  │ Metadata │  │ (FIFO)   │  │ Subs     │    │
│  └──────────┘  └──────────┘  └──────────┘  └────┬─────┘    │
│                                                  │          │
└──────────────────────────────────────────────────│──────────┘
                                                   │
          ┌────────────────────────────────────────┤
          │                                        │
          ▼                                        ▼
┌─────────────────────┐              ┌─────────────────────────┐
│   DevLoggerUI       │◄────────────►│   Pop-out Window        │
│   (Shadow DOM)      │  Broadcast   │   (Separate Window)     │
│                     │   Channel    │                         │
│  ┌───────────────┐  │              │  ┌───────────────────┐  │
│  │ Filter Bar    │  │              │  │ Synced Logs       │  │
│  │ Log List      │  │              │  │ Clear Button      │  │
│  │ Toggle Button │  │              │  │ Connection Status │  │
│  └───────────────┘  │              │  └───────────────────┘  │
└─────────────────────┘              └─────────────────────────┘
```

## Design Principles

1. **Zero-Throw Policy** - The logger never throws exceptions. If something goes wrong internally, it fails silently to avoid breaking your app.

2. **UI-Agnostic Core** - The `LoggerCore` has no knowledge of the UI. It only manages logs and notifies subscribers.

3. **Shadow DOM Isolation** - The UI uses Shadow DOM to prevent CSS conflicts with your application.

4. **Strict Decoupling** - The logger and UI are completely independent. You can use the logger without the UI, or create your own UI using the `subscribe()` API.

5. **No Side Effects on Import** - Importing the logger doesn't create any DOM elements or start any listeners. You must explicitly call `DevLoggerUI.init()`.

## Browser Support

- Chrome/Edge 80+
- Firefox 78+
- Safari 14+

Requires support for:
- Shadow DOM
- BroadcastChannel
- ES2020+

## License

MIT
