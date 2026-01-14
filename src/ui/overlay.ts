/**
 * Debug UI Overlay - Phase 4, 5, 6 Implementation
 *
 * Shadow DOM based overlay that displays logs in real-time.
 * Features:
 * - Toggle button (floating)
 * - Keyboard shortcut (Ctrl+Shift+L)
 * - Auto-scroll for new logs
 * - Level-coded log entries
 * - Expandable data
 * - Pop-out window with BroadcastChannel sync
 * - Filter & Search (Level, Text, File)
 */

import { logger } from '../core/logger';
import type { LogEvent, LogLevel, Unsubscribe } from '../core/types';
import { STYLES } from './styles';
import { createLogEntry, createEmptyState } from './log-entry';
import { channel, type ChannelMessage } from '../channel/broadcast';
import { openPopout, closePopout, isPopoutOpen } from './popout';
import {
  type FilterState,
  createDefaultFilterState,
  filterLogs,
  isFilterActive,
  createFilterBarHtml,
} from './filter';

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
  filterBar: HTMLElement | null;
  toggleBtn: HTMLElement | null;
  badge: HTMLElement | null;
  unsubscribe: Unsubscribe | null;
  channelUnsubscribe: (() => void) | null;
  filter: FilterState;
}

const state: UIState = {
  initialized: false,
  visible: false,
  host: null,
  shadow: null,
  container: null,
  logsList: null,
  filterBar: null,
  toggleBtn: null,
  badge: null,
  unsubscribe: null,
  channelUnsubscribe: null,
  filter: createDefaultFilterState(),
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

  const logs = logger.getLogs();
  const filteredLogs = filterLogs(logs, state.filter);

  container.innerHTML = `
    <div class="devlogger-header">
      <div class="devlogger-title">
        DevLogger
        <span class="devlogger-badge">${filteredLogs.length}</span>
      </div>
      <div class="devlogger-actions">
        <button class="devlogger-btn" data-action="clear" title="Clear logs">Clear</button>
        <button class="devlogger-btn devlogger-btn-primary" data-action="popout" title="Open in new window">Pop-out</button>
        <button class="devlogger-btn" data-action="close" title="Close (Ctrl+Shift+L)">✕</button>
      </div>
    </div>
    <div class="filter-bar-container"></div>
    <div class="devlogger-logs"></div>
    <div class="devlogger-footer">
      <span class="devlogger-log-count">${logs.length} logs</span>
      <span class="devlogger-shortcut">Ctrl+Shift+L to toggle</span>
    </div>
  `;

  // Get references
  state.badge = container.querySelector('.devlogger-badge');
  state.logsList = container.querySelector('.devlogger-logs');
  state.filterBar = container.querySelector('.filter-bar-container');

  // Add button handlers
  container.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const action = (e.currentTarget as HTMLElement).dataset.action;
      switch (action) {
        case 'clear':
          logger.clear();
          channel.sendClear();
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

  // Render filter bar and logs
  renderFilterBar();
  renderLogs();
}

/**
 * Render the filter bar
 */
function renderFilterBar(): void {
  if (!state.filterBar) return;

  const logs = logger.getLogs();
  const filteredLogs = filterLogs(logs, state.filter);

  state.filterBar.innerHTML = createFilterBarHtml(state.filter, logs.length, filteredLogs.length);

  // Add event listeners for filter controls
  setupFilterListeners();
}

/**
 * Set up filter event listeners
 */
function setupFilterListeners(): void {
  if (!state.filterBar) return;

  // Level buttons
  state.filterBar.querySelectorAll('.filter-level-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const level = (e.currentTarget as HTMLElement).dataset.level as LogLevel;
      if (state.filter.levels.has(level)) {
        state.filter.levels.delete(level);
      } else {
        state.filter.levels.add(level);
      }
      renderFilterBar();
      renderLogs();
    });
  });

  // Search input - don't re-render the filter bar to keep focus
  const searchInput = state.filterBar.querySelector('[data-filter="search"]') as HTMLInputElement;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.filter.search = (e.target as HTMLInputElement).value;
      updateFilterStatus();
      renderLogs();
    });
  }

  // File input - don't re-render the filter bar to keep focus
  const fileInput = state.filterBar.querySelector('[data-filter="file"]') as HTMLInputElement;
  if (fileInput) {
    fileInput.addEventListener('input', (e) => {
      state.filter.file = (e.target as HTMLInputElement).value;
      updateFilterStatus();
      renderLogs();
    });
  }

  // Clear button
  const clearBtn = state.filterBar.querySelector('.filter-clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      state.filter = createDefaultFilterState();
      renderFilterBar();
      renderLogs();
    });
  }
}

/**
 * Render all logs to the list (with filtering)
 */
function renderLogs(): void {
  if (!state.logsList) return;

  const logs = logger.getLogs();
  const filteredLogs = filterLogs(logs, state.filter);

  state.logsList.innerHTML = '';

  if (logs.length === 0) {
    state.logsList.appendChild(createEmptyState());
  } else if (filteredLogs.length === 0) {
    // No results after filtering
    const noResults = document.createElement('div');
    noResults.className = 'devlogger-no-results';
    noResults.innerHTML = `
      <span class="devlogger-no-results-icon">🔍</span>
      <span class="devlogger-no-results-text">No logs match your filter</span>
    `;
    state.logsList.appendChild(noResults);
  } else {
    const fragment = document.createDocumentFragment();
    for (const log of filteredLogs) {
      fragment.appendChild(createLogEntry(log));
    }
    state.logsList.appendChild(fragment);
  }

  updateBadge(filteredLogs.length, logs.length);
  scrollToBottom();
}

/**
 * Add a single log entry (optimized for streaming)
 */
function addLogEntry(log: LogEvent): void {
  if (!state.logsList) return;

  const logs = logger.getLogs();
  const filteredLogs = filterLogs(logs, state.filter);

  // Check if this log matches the filter
  const matchesCurrentFilter = filteredLogs.some((l) => l.id === log.id);

  if (matchesCurrentFilter) {
    // Remove empty state or no-results state if present
    const empty = state.logsList.querySelector('.devlogger-empty, .devlogger-no-results');
    if (empty) {
      empty.remove();
    }

    state.logsList.appendChild(createLogEntry(log));
  }

  updateBadge(filteredLogs.length, logs.length);
  updateFilterStatus();
  scrollToBottom();
}

/**
 * Update the log count badge
 */
function updateBadge(filteredCount: number, totalCount: number): void {
  if (state.badge) {
    state.badge.textContent = String(filteredCount);
  }

  // Update footer count
  const footerCount = state.container?.querySelector('.devlogger-log-count');
  if (footerCount) {
    if (isFilterActive(state.filter)) {
      footerCount.textContent = `${filteredCount} of ${totalCount} logs`;
    } else {
      footerCount.textContent = `${totalCount} logs`;
    }
  }
}

/**
 * Update filter status display (without re-rendering inputs)
 */
function updateFilterStatus(): void {
  if (!state.filterBar) return;

  const logs = logger.getLogs();
  const filteredLogs = filterLogs(logs, state.filter);
  const active = isFilterActive(state.filter);

  // Update filter-active class on the filter-bar
  const filterBar = state.filterBar.querySelector('.filter-bar');
  if (filterBar) {
    filterBar.classList.toggle('filter-active', active);
  }

  // Update or create status element
  let statusEl = state.filterBar.querySelector('.filter-status');
  if (active) {
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.className = 'filter-status';
      filterBar?.appendChild(statusEl);
    }
    statusEl.textContent = `Showing ${filteredLogs.length} of ${logs.length} logs`;

    // Add clear button if not present
    let clearBtn = state.filterBar.querySelector('.filter-clear-btn');
    if (!clearBtn) {
      clearBtn = document.createElement('button');
      clearBtn.className = 'filter-clear-btn';
      clearBtn.setAttribute('title', 'Clear filters');
      clearBtn.textContent = '✕';
      clearBtn.addEventListener('click', () => {
        state.filter = createDefaultFilterState();
        renderFilterBar();
        renderLogs();
      });
      const filterRow = state.filterBar.querySelector('.filter-row');
      filterRow?.appendChild(clearBtn);
    }
  } else {
    // Remove status and clear button when filter is inactive
    statusEl?.remove();
    state.filterBar.querySelector('.filter-clear-btn')?.remove();
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
 * Handle messages from pop-out window
 */
function handleChannelMessage(message: ChannelMessage): void {
  switch (message.type) {
    case 'CLEAR_LOGS':
      logger.clear();
      renderLogs();
      break;
    case 'SYNC_REQUEST':
      channel.sendSyncResponse(logger.getLogs());
      break;
  }
}

/**
 * DevLogger UI Public API
 */
export const DevLoggerUI = {
  /**
   * Initialize the overlay UI
   */
  init(): void {
    try {
      if (state.initialized) {
        return;
      }

      if (typeof document === 'undefined') {
        return;
      }

      const host = document.createElement('div');
      host.id = 'devlogger-host';
      document.body.appendChild(host);
      state.host = host;

      const shadow = host.attachShadow({ mode: 'open' });
      state.shadow = shadow;

      createOverlayDOM(shadow);

      state.unsubscribe = logger.subscribe((log) => {
        addLogEntry(log);
        channel.sendLog(log);
      });

      state.channelUnsubscribe = channel.subscribe(handleChannelMessage);

      document.addEventListener('keydown', handleKeydown);

      state.initialized = true;
    } catch (e) {
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
   */
  popout(): void {
    try {
      if (!state.initialized) {
        this.init();
      }
      openPopout();
    } catch (e) {
      console.warn('[DevLogger] Failed to open pop-out:', e);
    }
  },

  /**
   * Close the pop-out window
   */
  closePopout(): void {
    closePopout();
  },

  /**
   * Check if pop-out window is open
   */
  isPopoutOpen(): boolean {
    return isPopoutOpen();
  },

  /**
   * Set filter state
   */
  setFilter(filter: Partial<FilterState>): void {
    try {
      if (filter.levels !== undefined) {
        state.filter.levels = filter.levels;
      }
      if (filter.search !== undefined) {
        state.filter.search = filter.search;
      }
      if (filter.file !== undefined) {
        state.filter.file = filter.file;
      }
      renderFilterBar();
      renderLogs();
    } catch {
      // Silent fail
    }
  },

  /**
   * Get current filter state
   */
  getFilter(): FilterState {
    return { ...state.filter, levels: new Set(state.filter.levels) };
  },

  /**
   * Clear all filters
   */
  clearFilter(): void {
    try {
      state.filter = createDefaultFilterState();
      renderFilterBar();
      renderLogs();
    } catch {
      // Silent fail
    }
  },

  /**
   * Destroy the UI and clean up
   */
  destroy(): void {
    try {
      closePopout();

      if (state.unsubscribe) {
        state.unsubscribe();
        state.unsubscribe = null;
      }

      if (state.channelUnsubscribe) {
        state.channelUnsubscribe();
        state.channelUnsubscribe = null;
      }

      document.removeEventListener('keydown', handleKeydown);

      if (state.host) {
        state.host.remove();
        state.host = null;
      }

      state.initialized = false;
      state.visible = false;
      state.shadow = null;
      state.container = null;
      state.logsList = null;
      state.filterBar = null;
      state.toggleBtn = null;
      state.badge = null;
      state.filter = createDefaultFilterState();
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
