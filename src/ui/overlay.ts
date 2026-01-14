/**
 * Debug UI Overlay - Phase 4 Implementation
 *
 * Shadow DOM based overlay that displays logs in real-time.
 * Features:
 * - Toggle button (floating)
 * - Keyboard shortcut (Ctrl+Shift+L)
 * - Auto-scroll for new logs
 * - Level-coded log entries
 * - Expandable data
 */

import { logger } from '../core/logger';
import type { LogEvent, Unsubscribe } from '../core/types';
import { STYLES } from './styles';
import { createLogEntry, createEmptyState } from './log-entry';

/** Keyboard shortcut for toggle */
const SHORTCUT = { key: 'l', ctrlKey: true, shiftKey: true };

/** DevLogger UI State */
interface UIState {
  initialized: boolean;
  visible: boolean;
  host: HTMLElement | null;
  shadow: ShadowRoot | null;
  container: HTMLElement | null;
  logsList: HTMLElement | null;
  toggleBtn: HTMLElement | null;
  badge: HTMLElement | null;
  unsubscribe: Unsubscribe | null;
}

const state: UIState = {
  initialized: false,
  visible: false,
  host: null,
  shadow: null,
  container: null,
  logsList: null,
  toggleBtn: null,
  badge: null,
  unsubscribe: null,
};

/**
 * Create the overlay DOM structure
 */
function createOverlayDOM(shadow: ShadowRoot): void {
  // Add styles
  const style = document.createElement('style');
  style.textContent = STYLES;
  shadow.appendChild(style);

  // Toggle button (floating)
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'devlogger-toggle';
  toggleBtn.innerHTML = '📋';
  toggleBtn.title = 'Toggle DevLogger (Ctrl+Shift+L)';
  toggleBtn.addEventListener('click', () => DevLoggerUI.toggle());
  shadow.appendChild(toggleBtn);
  state.toggleBtn = toggleBtn;

  // Main container
  const container = document.createElement('div');
  container.className = 'devlogger-container hidden';

  const logCount = logger.getLogs().length;

  container.innerHTML = `
    <div class="devlogger-header">
      <div class="devlogger-title">
        DevLogger
        <span class="devlogger-badge">${logCount}</span>
      </div>
      <div class="devlogger-actions">
        <button class="devlogger-btn" data-action="clear" title="Clear logs">Clear</button>
        <button class="devlogger-btn" data-action="popout" title="Open in new window">Pop-out</button>
        <button class="devlogger-btn" data-action="close" title="Close (Ctrl+Shift+L)">✕</button>
      </div>
    </div>
    <div class="devlogger-logs"></div>
    <div class="devlogger-footer">
      <span class="devlogger-log-count">${logCount} logs</span>
      <span class="devlogger-shortcut">Ctrl+Shift+L to toggle</span>
    </div>
  `;

  // Get references
  state.badge = container.querySelector('.devlogger-badge');
  state.logsList = container.querySelector('.devlogger-logs');

  // Add button handlers
  container.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const action = (e.currentTarget as HTMLElement).dataset.action;
      switch (action) {
        case 'clear':
          logger.clear();
          renderLogs();
          break;
        case 'popout':
          DevLoggerUI.popout();
          break;
        case 'close':
          DevLoggerUI.close();
          break;
      }
    });
  });

  shadow.appendChild(container);
  state.container = container;

  // Render existing logs
  renderLogs();
}

/**
 * Render all logs to the list
 */
function renderLogs(): void {
  if (!state.logsList) return;

  const logs = logger.getLogs();
  state.logsList.innerHTML = '';

  if (logs.length === 0) {
    state.logsList.appendChild(createEmptyState());
  } else {
    const fragment = document.createDocumentFragment();
    for (const log of logs) {
      fragment.appendChild(createLogEntry(log));
    }
    state.logsList.appendChild(fragment);
  }

  updateBadge(logs.length);
  scrollToBottom();
}

/**
 * Add a single log entry (optimized for streaming)
 */
function addLogEntry(log: LogEvent): void {
  if (!state.logsList) return;

  // Remove empty state if present
  const empty = state.logsList.querySelector('.devlogger-empty');
  if (empty) {
    empty.remove();
  }

  state.logsList.appendChild(createLogEntry(log));
  updateBadge(logger.getLogs().length);
  scrollToBottom();
}

/**
 * Update the log count badge
 */
function updateBadge(count: number): void {
  if (state.badge) {
    state.badge.textContent = String(count);
  }

  // Update footer count too
  const footerCount = state.container?.querySelector('.devlogger-log-count');
  if (footerCount) {
    footerCount.textContent = `${count} logs`;
  }
}

/**
 * Auto-scroll to bottom
 */
function scrollToBottom(): void {
  if (state.logsList && state.visible) {
    state.logsList.scrollTop = state.logsList.scrollHeight;
  }
}

/**
 * Handle keyboard shortcuts
 */
function handleKeydown(e: KeyboardEvent): void {
  if (
    e.key.toLowerCase() === SHORTCUT.key &&
    e.ctrlKey === SHORTCUT.ctrlKey &&
    e.shiftKey === SHORTCUT.shiftKey
  ) {
    e.preventDefault();
    DevLoggerUI.toggle();
  }
}

/**
 * DevLogger UI Public API
 */
export const DevLoggerUI = {
  /**
   * Initialize the overlay UI
   * Call this once when your app starts
   */
  init(): void {
    try {
      if (state.initialized) {
        return;
      }

      // Check if we're in a browser environment
      if (typeof document === 'undefined') {
        return;
      }

      // Create host element
      const host = document.createElement('div');
      host.id = 'devlogger-host';
      document.body.appendChild(host);
      state.host = host;

      // Create shadow DOM for isolation
      const shadow = host.attachShadow({ mode: 'open' });
      state.shadow = shadow;

      // Create DOM structure
      createOverlayDOM(shadow);

      // Subscribe to new logs
      state.unsubscribe = logger.subscribe((log) => {
        addLogEntry(log);
      });

      // Register keyboard shortcut
      document.addEventListener('keydown', handleKeydown);

      state.initialized = true;
    } catch (e) {
      // Silent fail - UI errors should not break the app
      console.warn('[DevLogger UI] Init error:', e);
    }
  },

  /**
   * Open the overlay panel
   */
  open(): void {
    try {
      if (!state.initialized) {
        this.init();
      }

      if (state.container) {
        state.container.classList.remove('hidden');
        state.visible = true;
        scrollToBottom();
      }
    } catch {
      // Silent fail
    }
  },

  /**
   * Close the overlay panel
   */
  close(): void {
    try {
      if (state.container) {
        state.container.classList.add('hidden');
        state.visible = false;
      }
    } catch {
      // Silent fail
    }
  },

  /**
   * Toggle the overlay panel
   */
  toggle(): void {
    if (state.visible) {
      this.close();
    } else {
      this.open();
    }
  },

  /**
   * Open logs in a separate window
   * (Placeholder - will be implemented in Phase 5)
   */
  popout(): void {
    // TODO: Implement in Phase 5
    console.log('[DevLogger] Pop-out will be implemented in Phase 5');
  },

  /**
   * Destroy the UI and clean up
   */
  destroy(): void {
    try {
      // Unsubscribe from logger
      if (state.unsubscribe) {
        state.unsubscribe();
        state.unsubscribe = null;
      }

      // Remove keyboard listener
      document.removeEventListener('keydown', handleKeydown);

      // Remove DOM elements
      if (state.host) {
        state.host.remove();
        state.host = null;
      }

      // Reset state
      state.initialized = false;
      state.visible = false;
      state.shadow = null;
      state.container = null;
      state.logsList = null;
      state.toggleBtn = null;
      state.badge = null;
    } catch {
      // Silent fail
    }
  },

  /**
   * Check if the UI is currently visible
   */
  isVisible(): boolean {
    return state.visible;
  },

  /**
   * Check if the UI has been initialized
   */
  isInitialized(): boolean {
    return state.initialized;
  },
};
