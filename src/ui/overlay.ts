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
import type { LogEvent, LogLevel, SpanEvent, Unsubscribe } from '../core/types';
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

type ShortcutAction = 'toggle' | 'popout';

function getShortcutAction(): ShortcutAction {
  const action = logger.getConfig().shortcutAction;
  return action === 'popout' ? 'popout' : 'toggle';
}

function getShortcutHint(): string {
  return getShortcutAction() === 'popout' ? 'Ctrl+Shift+L to open pop-out' : 'Ctrl+Shift+L to toggle';
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatSpanDuration(span: SpanEvent): string {
  if (span.duration === undefined) return 'running';
  return `${Math.round(span.duration)}ms`;
}

/**
 * Show feedback after copy action
 */
function showCopyFeedback(button: HTMLButtonElement, success: boolean): void {
  const originalText = button.textContent;
  button.textContent = success ? '✓' : '✗';
  button.disabled = true;
  setTimeout(() => {
    button.textContent = originalText;
    button.disabled = false;
  }, 1000);
}

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
  resourceContainer: HTMLElement | null;
  resourceStatus: HTMLElement | null;
  resourceMetrics: HTMLElement | null;
  resourceNote: HTMLElement | null;
  resourceHeapUsed: HTMLElement | null;
  resourceHeapTotal: HTMLElement | null;
  resourceHeapLimit: HTMLElement | null;
  resourceVisible: boolean;
  resourceInterval: number | null;
  resourceSupported: boolean;
  unsubscribe: Unsubscribe | null;
  spanUnsubscribe: Unsubscribe | null;
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
  resourceContainer: null,
  resourceStatus: null,
  resourceMetrics: null,
  resourceNote: null,
  resourceHeapUsed: null,
  resourceHeapTotal: null,
  resourceHeapLimit: null,
  resourceVisible: false,
  resourceInterval: null,
  resourceSupported: typeof performance !== 'undefined' && 'memory' in performance,
  unsubscribe: null,
  spanUnsubscribe: null,
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
  if (logger.getConfig().showToggleButton) {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'devlogger-toggle';
    toggleBtn.innerHTML = '📋';
    toggleBtn.title = getShortcutAction() === 'popout' ? 'Toggle DevLogger' : 'Toggle DevLogger (Ctrl+Shift+L)';
    toggleBtn.addEventListener('click', () => DevLoggerUI.toggle());
    shadow.appendChild(toggleBtn);
    state.toggleBtn = toggleBtn;
  }

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
        <button class="devlogger-btn" data-action="copy-json" title="Copy as JSON">JSON</button>
        <button class="devlogger-btn" data-action="copy-text" title="Copy as Text">TXT</button>
        <button class="devlogger-btn" data-action="clear" title="Clear logs">Clear</button>
        <button class="devlogger-btn" data-action="resources" title="Toggle Resource Monitor">Resources</button>
        <button class="devlogger-btn devlogger-btn-primary" data-action="popout" title="Open in new window">Pop-out</button>
        <button class="devlogger-btn" data-action="close" title="Close">✕</button>
      </div>
    </div>
    <div class="resource-container" id="devlogger-resources">
      <div class="resource-header">
        <span>Resource Monitor</span>
        <span class="resource-status" id="devlogger-resources-status"></span>
      </div>
      <div class="resource-metrics" id="devlogger-resources-metrics">
        <span class="resource-label">JS Heap Used</span>
        <span class="resource-value" id="devlogger-heap-used">-</span>
        <span class="resource-label">JS Heap Total</span>
        <span class="resource-value" id="devlogger-heap-total">-</span>
        <span class="resource-label">JS Heap Limit</span>
        <span class="resource-value" id="devlogger-heap-limit">-</span>
      </div>
      <div class="resource-note" id="devlogger-resources-note" style="display: none;">
        Resource metrics are available only in Chrome.
      </div>
    </div>
    <div class="filter-bar-container"></div>
    <div class="devlogger-logs"></div>
    <div class="devlogger-footer">
      <span class="devlogger-log-count">${logs.length} logs</span>
      <span class="devlogger-shortcut">${getShortcutHint()}</span>
    </div>
  `;

  // Get references
  state.badge = container.querySelector('.devlogger-badge');
  state.logsList = container.querySelector('.devlogger-logs');
  state.filterBar = container.querySelector('.filter-bar-container');
  state.resourceContainer = container.querySelector('#devlogger-resources');
  state.resourceStatus = container.querySelector('#devlogger-resources-status');
  state.resourceMetrics = container.querySelector('#devlogger-resources-metrics');
  state.resourceNote = container.querySelector('#devlogger-resources-note');
  state.resourceHeapUsed = container.querySelector('#devlogger-heap-used');
  state.resourceHeapTotal = container.querySelector('#devlogger-heap-total');
  state.resourceHeapLimit = container.querySelector('#devlogger-heap-limit');

  // Add button handlers
  container.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const action = (e.currentTarget as HTMLElement).dataset.action;
      const button = e.currentTarget as HTMLButtonElement;
      switch (action) {
        case 'clear':
          logger.clear();
          channel.sendClear();
          renderLogs();
          break;
        case 'resources':
          toggleResources(button);
          break;
        case 'popout':
          DevLoggerUI.popout();
          break;
        case 'close':
          DevLoggerUI.close();
          break;
        case 'copy-json':
          void logger.copyLogs({ format: 'json' }).then((success) => {
            showCopyFeedback(button, success);
          });
          break;
        case 'copy-text':
          void logger.copyLogs({ format: 'text' }).then((success) => {
            showCopyFeedback(button, success);
          });
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

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '-';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function updateResourceSupportUI(): void {
  if (!state.resourceStatus || !state.resourceMetrics || !state.resourceNote) return;
  if (state.resourceSupported) {
    state.resourceStatus.textContent = 'Chrome API';
    state.resourceMetrics.style.display = 'grid';
    state.resourceNote.style.display = 'none';
  } else {
    state.resourceStatus.textContent = 'Unsupported';
    state.resourceMetrics.style.display = 'none';
    state.resourceNote.style.display = 'block';
  }
}

function updateResourceMetrics(): void {
  if (!state.resourceSupported) return;
  const memory = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } })
    .memory;
  if (!memory || !state.resourceHeapUsed || !state.resourceHeapTotal || !state.resourceHeapLimit) return;
  state.resourceHeapUsed.textContent = formatBytes(memory.usedJSHeapSize);
  state.resourceHeapTotal.textContent = formatBytes(memory.totalJSHeapSize);
  state.resourceHeapLimit.textContent = formatBytes(memory.jsHeapSizeLimit);
}

function startResourceUpdates(): void {
  if (state.resourceInterval || !state.resourceSupported) return;
  updateResourceMetrics();
  state.resourceInterval = window.setInterval(updateResourceMetrics, 1000);
}

function stopResourceUpdates(): void {
  if (state.resourceInterval) {
    clearInterval(state.resourceInterval);
    state.resourceInterval = null;
  }
}

function toggleResources(button?: HTMLButtonElement): void {
  if (!state.resourceContainer) return;
  state.resourceVisible = !state.resourceVisible;
  state.resourceContainer.style.display = state.resourceVisible ? 'block' : 'none';
  if (button) {
    button.classList.toggle('active', state.resourceVisible);
  }
  if (state.resourceVisible) {
    updateResourceSupportUI();
    startResourceUpdates();
  } else {
    stopResourceUpdates();
  }
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
    const spanGroups = new Map<string, HTMLElement>();
    const spanLogContainers = new Map<string, HTMLElement>();
    const spanLogCounts = new Map<string, number>();
    for (const log of filteredLogs) {
      if (!log.spanId) {
        fragment.appendChild(createLogEntry(log));
        continue;
      }

      let group = spanGroups.get(log.spanId);
      if (!group) {
        const spanEvent = logger.getSpan(log.spanId);
        group = createSpanGroup(log.spanId, spanEvent);
        spanGroups.set(log.spanId, group);
        const container = group.querySelector('.span-logs');
        if (container) {
          spanLogContainers.set(log.spanId, container as HTMLElement);
        }
        fragment.appendChild(group);
      }

      const spanLogs = spanLogContainers.get(log.spanId);
      if (spanLogs) {
        spanLogs.appendChild(createLogEntry(log));
      }

      spanLogCounts.set(log.spanId, (spanLogCounts.get(log.spanId) ?? 0) + 1);
    }
    for (const [spanId, count] of spanLogCounts) {
      const group = spanGroups.get(spanId);
      const countEl = group?.querySelector('.span-count');
      if (countEl) {
        countEl.textContent = `${count} log${count === 1 ? '' : 's'}`;
      }
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
    if (log.spanId) {
      let group = state.logsList.querySelector(`.span-group[data-span-id="${log.spanId}"]`) as HTMLElement | null;
      if (!group) {
        const spanEvent = logger.getSpan(log.spanId);
        group = createSpanGroup(log.spanId, spanEvent);
        state.logsList.appendChild(group);
      }
      const spanLogs = group.querySelector('.span-logs') as HTMLElement | null;
      if (spanLogs) {
        spanLogs.appendChild(createLogEntry(log));
        updateSpanGroupCount(group, spanLogs);
      }
    } else {
      state.logsList.appendChild(createLogEntry(log));
    }
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

function updateSpanGroupCount(group: HTMLElement, spanLogs: HTMLElement): void {
  const countEl = group.querySelector('.span-count');
  if (countEl) {
    const count = spanLogs.querySelectorAll('.log-entry').length;
    countEl.textContent = `${count} log${count === 1 ? '' : 's'}`;
  }
}

function createSpanGroup(spanId: string, span: SpanEvent | undefined): HTMLElement {
  const group = document.createElement('div');
  group.className = 'span-group';
  group.dataset.spanId = spanId;

  const name = span?.name ?? 'Span';
  const status = span?.status ?? 'running';
  const duration = span ? formatSpanDuration(span) : 'running';

  const header = document.createElement('div');
  header.className = 'span-header';
  header.innerHTML = `
    <button class="span-toggle" type="button" aria-label="Toggle span logs"></button>
    <span class="span-title">${escapeHtml(name)}</span>
    <span class="span-status span-status-${status}">${status}</span>
    <span class="span-duration">${duration}</span>
    <span class="span-count">0 logs</span>
  `;

  const logs = document.createElement('div');
  logs.className = 'span-logs';

  if (logger.getConfig().spanCollapsed) {
    group.classList.add('collapsed');
  }

  const toggle = header.querySelector('.span-toggle');
  const toggleHandler = () => {
    group.classList.toggle('collapsed');
  };
  header.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('.span-toggle')) {
      return;
    }
    toggleHandler();
  });
  toggle?.addEventListener('click', () => toggleHandler());

  group.appendChild(header);
  group.appendChild(logs);

  return group;
}

function updateSpanHeader(span: SpanEvent): void {
  const group = state.logsList?.querySelector(`.span-group[data-span-id="${span.id}"]`) as HTMLElement | null;
  if (!group) return;

  const titleEl = group.querySelector('.span-title');
  if (titleEl) {
    titleEl.textContent = span.name;
  }

  const statusEl = group.querySelector('.span-status');
  if (statusEl) {
    statusEl.textContent = span.status;
    statusEl.className = `span-status span-status-${span.status}`;
  }

  const durationEl = group.querySelector('.span-duration');
  if (durationEl) {
    durationEl.textContent = formatSpanDuration(span);
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
    if (getShortcutAction() === 'popout') {
      DevLoggerUI.popout();
    } else {
      DevLoggerUI.toggle();
    }
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

      // Skip initialization if logger is disabled (e.g., in production)
      if (!logger.isEnabled()) {
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
      state.spanUnsubscribe = logger.subscribeSpans((span) => {
        updateSpanHeader(span);
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

      if (state.spanUnsubscribe) {
        state.spanUnsubscribe();
      state.spanUnsubscribe = null;
    }

    stopResourceUpdates();

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
      state.resourceContainer = null;
      state.resourceStatus = null;
      state.resourceMetrics = null;
      state.resourceNote = null;
      state.resourceHeapUsed = null;
      state.resourceHeapTotal = null;
      state.resourceHeapLimit = null;
      state.resourceVisible = false;
      state.resourceInterval = null;
      state.spanUnsubscribe = null;
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
