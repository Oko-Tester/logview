/**
 * Pop-out Window Manager
 *
 * Handles:
 * - Opening pop-out window
 * - Synchronizing logs via BroadcastChannel
 * - Maintaining connection when main app crashes
 */

import { channel, type ChannelMessage } from "../channel/broadcast";
import { logger } from "../core/logger";

/** Pop-out window dimensions */
const POPOUT_WIDTH = 500;
const POPOUT_HEIGHT = 700;

/** Pop-out window reference */
let popoutWindow: Window | null = null;

/** Check if we're running inside the pop-out window */
export function isPopoutWindow(): boolean {
  try {
    return window.name === "devlogger-popout";
  } catch {
    return false;
  }
}

/**
 * Open the pop-out window
 */
export function openPopout(): Window | null {
  try {
    // Check if already open
    if (popoutWindow && !popoutWindow.closed) {
      popoutWindow.focus();
      return popoutWindow;
    }

    // Calculate position (center of screen)
    const left = Math.max(0, (screen.width - POPOUT_WIDTH) / 2);
    const top = Math.max(0, (screen.height - POPOUT_HEIGHT) / 2);

    // Generate pop-out HTML content
    const popoutHtml = generatePopoutHtml();

    // Open new window
    popoutWindow = window.open(
      "",
      "devlogger-popout",
      `width=${POPOUT_WIDTH},height=${POPOUT_HEIGHT},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!popoutWindow) {
      console.warn("[DevLogger] Pop-out blocked by browser");
      return null;
    }

    // Write content to window
    popoutWindow.document.open();
    popoutWindow.document.write(popoutHtml);
    popoutWindow.document.close();

    // Send initial sync after window loads
    popoutWindow.addEventListener("load", () => {
      // Give the pop-out time to set up its channel listener
      setTimeout(() => {
        channel.sendSyncResponse(logger.getLogs());
      }, 100);
    });

    return popoutWindow;
  } catch (e) {
    console.warn("[DevLogger] Failed to open pop-out:", e);
    return null;
  }
}

/**
 * Close the pop-out window
 */
export function closePopout(): void {
  try {
    if (popoutWindow && !popoutWindow.closed) {
      popoutWindow.close();
    }
    popoutWindow = null;
  } catch {
    // Silent fail
  }
}

/**
 * Check if pop-out is open
 */
export function isPopoutOpen(): boolean {
  return popoutWindow !== null && !popoutWindow.closed;
}

/**
 * Set up main window as log broadcaster
 */
export function setupMainWindowBroadcast(): void {
  // Subscribe to logger and broadcast new logs
  logger.subscribe((log) => {
    channel.sendLog(log);
  });

  // Handle sync requests from pop-out
  channel.subscribe((message: ChannelMessage) => {
    if (message.type === "SYNC_REQUEST") {
      channel.sendSyncResponse(logger.getLogs());
    }
  });
}

/**
 * Generate the HTML content for the pop-out window
 */
function generatePopoutHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevLogger - Pop-out</title>
  <style>
    :root {
      --bg-primary: #1e1e1e;
      --bg-secondary: #252526;
      --bg-hover: #2a2a2a;
      --bg-header: #333333;
      --text-primary: #cccccc;
      --text-secondary: #858585;
      --text-muted: #6e6e6e;
      --border: #3c3c3c;
      --level-debug: #6e6e6e;
      --level-info: #3794ff;
      --level-warn: #cca700;
      --level-error: #f14c4c;
      --button-bg: #0e639c;
      --button-hover: #1177bb;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 12px;
      line-height: 1.4;
      background: var(--bg-primary);
      color: var(--text-primary);
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: var(--bg-header);
      border-bottom: 1px solid var(--border);
    }

    .title {
      font-weight: 600;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .badge {
      background: var(--level-info);
      color: white;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: var(--text-muted);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #4caf50;
    }

    .status-dot.disconnected {
      background: var(--level-error);
    }

    .actions {
      display: flex;
      gap: 8px;
    }

    .btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-secondary);
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.15s ease;
    }

    .btn:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    .btn-copy {
      font-size: 10px;
      padding: 4px 8px;
    }

    .btn-copy.success {
      background: #4caf50;
      border-color: #4caf50;
      color: white;
    }

    .btn-copy.error {
      background: var(--level-error);
      border-color: var(--level-error);
      color: white;
    }

    .btn-timeline {
      font-size: 10px;
      padding: 4px 8px;
    }

    .btn-timeline.active {
      background: var(--level-info);
      border-color: var(--level-info);
      color: white;
    }

    /* Timeline Container */
    .timeline-container {
      position: relative;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border);
      padding: 8px;
    }

    #timeline-canvas {
      width: 100%;
      height: 120px;
      background: var(--bg-primary);
      border-radius: 4px;
    }

    .timeline-tooltip {
      position: absolute;
      background: var(--bg-header);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 11px;
      pointer-events: none;
      display: none;
      z-index: 100;
      max-width: 250px;
    }

    .timeline-controls {
      display: flex;
      justify-content: center;
      gap: 4px;
      margin-top: 6px;
    }

    .timeline-btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 2px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 10px;
    }

    .timeline-btn:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    .timeline-btn.active {
      background: var(--button-bg);
      border-color: var(--button-bg);
      color: white;
    }

    /* Filter Bar Styles */
    .filter-bar {
      padding: 8px 16px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border);
    }

    .filter-bar.filter-active {
      border-bottom-color: var(--level-info);
    }

    .filter-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .filter-levels {
      display: flex;
      gap: 4px;
    }

    .filter-level-btn {
      width: 24px;
      height: 24px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      transition: all 0.15s ease;
    }

    .filter-level-btn:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    .filter-level-btn.active {
      background: var(--bg-hover);
      color: var(--text-primary);
      border-color: var(--text-secondary);
    }

    .filter-level-btn[data-level="debug"].active { border-color: var(--level-debug); color: var(--level-debug); }
    .filter-level-btn[data-level="info"].active { border-color: var(--level-info); color: var(--level-info); }
    .filter-level-btn[data-level="warn"].active { border-color: var(--level-warn); color: var(--level-warn); }
    .filter-level-btn[data-level="error"].active { border-color: var(--level-error); color: var(--level-error); }

    .filter-input {
      flex: 1;
      min-width: 80px;
      padding: 4px 8px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--bg-primary);
      color: var(--text-primary);
      font-size: 12px;
      font-family: inherit;
    }

    .filter-input:focus {
      outline: none;
      border-color: var(--level-info);
    }

    .filter-input::placeholder {
      color: var(--text-muted);
    }

    .filter-clear-btn {
      width: 24px;
      height: 24px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      transition: all 0.15s ease;
    }

    .filter-clear-btn:hover {
      background: var(--level-error);
      border-color: var(--level-error);
      color: white;
    }

    .filter-status {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 6px;
    }

    .logs {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .logs::-webkit-scrollbar {
      width: 8px;
    }

    .logs::-webkit-scrollbar-track {
      background: var(--bg-primary);
    }

    .logs::-webkit-scrollbar-thumb {
      background: #4a4a4a;
      border-radius: 4px;
    }

    .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text-muted);
      font-style: italic;
    }

    .log-entry {
      border-bottom: 1px solid var(--border);
      padding: 10px 16px;
    }

    .log-entry:hover {
      background: var(--bg-hover);
    }

    .log-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 4px;
    }

    .log-level {
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 3px;
      min-width: 45px;
      text-align: center;
    }

    .log-level-debug { background: rgba(110, 110, 110, 0.2); color: var(--level-debug); }
    .log-level-info { background: rgba(55, 148, 255, 0.15); color: var(--level-info); }
    .log-level-warn { background: rgba(204, 167, 0, 0.15); color: var(--level-warn); }
    .log-level-error { background: rgba(241, 76, 76, 0.15); color: var(--level-error); }

    .log-time {
      color: var(--text-muted);
      font-size: 11px;
    }

    .log-source {
      color: var(--text-secondary);
      font-size: 11px;
      margin-left: auto;
    }

    .log-message {
      color: var(--text-primary);
      word-break: break-word;
    }

    .log-data {
      margin-top: 6px;
    }

    .log-data-toggle {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 2px 0;
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .log-data-toggle:hover {
      color: var(--text-primary);
    }

    .log-data-toggle::before {
      content: '▶';
      font-size: 8px;
      transition: transform 0.15s ease;
    }

    .log-data-toggle.expanded::before {
      transform: rotate(90deg);
    }

    .log-data-content {
      display: none;
      margin-top: 6px;
      padding: 8px;
      background: var(--bg-secondary);
      border-radius: 4px;
      font-size: 11px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .log-data-content.visible {
      display: block;
    }

    .footer {
      padding: 8px 16px;
      background: var(--bg-header);
      border-top: 1px solid var(--border);
      font-size: 11px;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">
      DevLogger
      <span class="badge" id="log-count">0</span>
    </div>
    <div class="status">
      <span class="status-dot" id="status-dot"></span>
      <span id="status-text">Connected</span>
    </div>
    <div class="actions">
      <button class="btn btn-copy" id="btn-copy-json" title="Copy as JSON">JSON</button>
      <button class="btn btn-copy" id="btn-copy-text" title="Copy as Text">TXT</button>
      <button class="btn btn-timeline" id="btn-timeline" title="Toggle Timeline">Timeline</button>
      <button class="btn btn-timeline" id="btn-timeline-pause" title="Pause/Resume Timeline" style="display: none;">⏸</button>
      <button class="btn" id="btn-clear">Clear</button>
    </div>
  </div>

  <div class="timeline-container" id="timeline-container" style="display: none;">
    <canvas id="timeline-canvas"></canvas>
    <div class="timeline-tooltip" id="timeline-tooltip"></div>
    <div class="timeline-controls">
      <button class="timeline-btn" data-window="10000">10s</button>
      <button class="timeline-btn active" data-window="30000">30s</button>
      <button class="timeline-btn" data-window="60000">60s</button>
    </div>
  </div>

  <div class="filter-bar" id="filter-bar">
    <div class="filter-row">
      <div class="filter-levels">
        <button class="filter-level-btn active" data-level="debug" title="Debug">D</button>
        <button class="filter-level-btn active" data-level="info" title="Info">I</button>
        <button class="filter-level-btn active" data-level="warn" title="Warning">W</button>
        <button class="filter-level-btn active" data-level="error" title="Error">E</button>
      </div>
      <input type="text" class="filter-input" id="filter-search" placeholder="Search logs..." data-filter="search">
      <input type="text" class="filter-input" id="filter-file" placeholder="Filter by file..." data-filter="file" style="max-width: 120px;">
      <button class="filter-clear-btn" title="Clear all filters">✕</button>
    </div>
    <div class="filter-status" id="filter-status" style="display: none;"></div>
  </div>

  <div class="logs" id="logs">
    <div class="empty">Waiting for logs...</div>
  </div>

  <div class="footer">
    <span id="footer-count">0 logs</span>
    <span>Pop-out Window</span>
  </div>

  <script>
    // Pop-out window script
    const CHANNEL_NAME = 'devlogger-sync';
    let logs = [];
    let channel = null;
    let isConnected = false;

    // Filter state
    const filter = {
      levels: new Set(['debug', 'info', 'warn', 'error']),
      search: '',
      file: ''
    };

    // DOM elements
    const logsContainer = document.getElementById('logs');
    const logCountBadge = document.getElementById('log-count');
    const footerCount = document.getElementById('footer-count');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const btnClear = document.getElementById('btn-clear');
    const btnCopyJson = document.getElementById('btn-copy-json');
    const btnCopyText = document.getElementById('btn-copy-text');
    const btnTimeline = document.getElementById('btn-timeline');
    const btnTimelinePause = document.getElementById('btn-timeline-pause');
    const timelineContainer = document.getElementById('timeline-container');
    const timelineCanvas = document.getElementById('timeline-canvas');
    const timelineTooltip = document.getElementById('timeline-tooltip');
    const filterBar = document.getElementById('filter-bar');

    // Timeline state
    let timelineVisible = false;
    let timelineWindow = 30000; // 30 seconds default
    let timelineInterval = null;
    let timelinePaused = false;
    const LEVEL_COLORS = {
      debug: '#6e6e6e',
      info: '#3794ff',
      warn: '#cca700',
      error: '#f14c4c'
    };
    const filterSearch = document.getElementById('filter-search');
    const filterFile = document.getElementById('filter-file');
    const filterStatus = document.getElementById('filter-status');
    const filterClearBtn = document.querySelector('.filter-clear-btn');

    // Connect to broadcast channel
    function connect() {
      try {
        channel = new BroadcastChannel(CHANNEL_NAME);
        channel.onmessage = handleMessage;
        isConnected = true;
        updateStatus(true);

        // Request sync from main window
        channel.postMessage({
          type: 'SYNC_REQUEST',
          senderId: 'popout',
          timestamp: Date.now()
        });
      } catch (e) {
        console.error('Failed to connect:', e);
        updateStatus(false);
      }
    }

    // Handle incoming messages
    function handleMessage(event) {
      const message = event.data;

      switch (message.type) {
        case 'NEW_LOG':
          addLog(message.payload);
          break;
        case 'SYNC_RESPONSE':
          syncLogs(message.payload);
          break;
        case 'CLEAR_LOGS':
          clearLogs();
          break;
      }
    }

    // Add a single log
    function addLog(log) {
      logs.push(log);
      // Only render if log matches current filter
      if (matchesFilter(log)) {
        // Remove empty state if present
        const empty = logsContainer.querySelector('.empty');
        if (empty) empty.remove();
        renderLog(log);
        scrollToBottom();
      }
      updateCounts();
      updateFilterUI();
    }

    // Sync all logs
    function syncLogs(newLogs) {
      logs = newLogs || [];
      renderAllLogs();
      updateCounts();
    }

    // Clear all logs
    function clearLogs() {
      logs = [];
      renderAllLogs();
      updateCounts();
    }

    // Check if a log matches the current filter
    function matchesFilter(log) {
      // Level filter
      if (filter.levels.size > 0 && !filter.levels.has(log.level)) {
        return false;
      }

      // File filter
      if (filter.file && !log.source.file.toLowerCase().includes(filter.file.toLowerCase())) {
        return false;
      }

      // Text search
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const messageMatch = log.message.toLowerCase().includes(searchLower);
        const dataMatch = JSON.stringify(log.data).toLowerCase().includes(searchLower);
        if (!messageMatch && !dataMatch) {
          return false;
        }
      }

      return true;
    }

    // Get filtered logs
    function getFilteredLogs() {
      return logs.filter(log => matchesFilter(log));
    }

    // Check if any filter is active
    function isFilterActive() {
      return filter.levels.size !== 4 || filter.search !== '' || filter.file !== '';
    }

    // Update filter UI
    function updateFilterUI() {
      const active = isFilterActive();
      const filteredLogs = getFilteredLogs();

      filterBar.classList.toggle('filter-active', active);

      if (active) {
        filterStatus.style.display = 'block';
        filterStatus.textContent = 'Showing ' + filteredLogs.length + ' of ' + logs.length + ' logs';
      } else {
        filterStatus.style.display = 'none';
      }

      // Update counts
      logCountBadge.textContent = filteredLogs.length;
      if (active) {
        footerCount.textContent = filteredLogs.length + ' of ' + logs.length + ' logs';
      } else {
        footerCount.textContent = logs.length + ' logs';
      }
    }

    // Render all logs
    function renderAllLogs() {
      const filteredLogs = getFilteredLogs();

      if (logs.length === 0) {
        logsContainer.innerHTML = '<div class="empty">No logs yet...</div>';
        updateFilterUI();
        return;
      }

      if (filteredLogs.length === 0) {
        logsContainer.innerHTML = '<div class="empty">No logs match your filter</div>';
        updateFilterUI();
        return;
      }

      logsContainer.innerHTML = '';
      filteredLogs.forEach(log => renderLog(log));
      scrollToBottom();
      updateFilterUI();
    }

    // Render a single log entry
    function renderLog(log) {
      // Remove empty state if present
      const empty = logsContainer.querySelector('.empty');
      if (empty) empty.remove();

      const entry = document.createElement('div');
      entry.className = 'log-entry';

      const time = formatTime(log.timestamp);
      const source = formatSource(log.source);
      const hasData = log.data && log.data.length > 0;
      const dataId = 'data-' + log.id;

      entry.innerHTML = \`
        <div class="log-header">
          <span class="log-level log-level-\${log.level}">\${log.level}</span>
          <span class="log-time">\${time}</span>
          <span class="log-source">\${escapeHtml(source)}</span>
        </div>
        <div class="log-message">\${escapeHtml(log.message)}</div>
        \${hasData ? \`
          <div class="log-data">
            <button class="log-data-toggle" data-target="\${dataId}">
              \${log.data.length} item\${log.data.length > 1 ? 's' : ''}
            </button>
            <pre class="log-data-content" id="\${dataId}">\${escapeHtml(formatData(log.data))}</pre>
          </div>
        \` : ''}
      \`;

      // Add toggle handler
      if (hasData) {
        const toggle = entry.querySelector('.log-data-toggle');
        const content = entry.querySelector('#' + dataId);
        toggle.addEventListener('click', () => {
          toggle.classList.toggle('expanded');
          content.classList.toggle('visible');
        });
      }

      logsContainer.appendChild(entry);
    }

    // Format timestamp
    function formatTime(timestamp) {
      const date = new Date(timestamp);
      return date.toTimeString().split(' ')[0] + '.' +
             date.getMilliseconds().toString().padStart(3, '0');
    }

    // Format source
    function formatSource(source) {
      if (!source || source.file === 'unknown') return 'unknown';
      return source.file + ':' + source.line;
    }

    // Format data
    function formatData(data) {
      try {
        return data.map(item =>
          typeof item === 'string' ? item : JSON.stringify(item, null, 2)
        ).join('\\n');
      } catch {
        return '[Unable to display]';
      }
    }

    // Escape HTML
    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    // Update counts
    function updateCounts() {
      const count = logs.length;
      logCountBadge.textContent = count;
      footerCount.textContent = count + ' logs';
    }

    // Update connection status
    function updateStatus(connected) {
      isConnected = connected;
      statusDot.className = 'status-dot' + (connected ? '' : ' disconnected');
      statusText.textContent = connected ? 'Connected' : 'Disconnected';
    }

    // Scroll to bottom
    function scrollToBottom() {
      logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    // Clear button handler
    btnClear.addEventListener('click', () => {
      if (channel) {
        channel.postMessage({
          type: 'CLEAR_LOGS',
          senderId: 'popout',
          timestamp: Date.now()
        });
      }
      clearLogs();
    });

    // Export logs as JSON
    function exportLogsJson() {
      const logsToExport = getFilteredLogs();
      return JSON.stringify(logsToExport, null, 2);
    }

    // Export logs as text
    function exportLogsText() {
      const logsToExport = getFilteredLogs();
      return logsToExport.map(log => {
        const time = new Date(log.timestamp).toISOString();
        const level = log.level.toUpperCase().padEnd(5);
        const source = log.source.file + ':' + log.source.line;
        const context = log.context ? ' [' + Object.entries(log.context).map(([k, v]) => k + '=' + v).join(', ') + ']' : '';
        const span = log.spanId ? ' (span: ' + log.spanId + ')' : '';
        const data = log.data.length > 0 ? '\\n  Data: ' + JSON.stringify(log.data) : '';
        return '[' + time + '] ' + level + ' ' + log.message + context + span + '\\n  Source: ' + source + data;
      }).join('\\n\\n');
    }

    // Show copy feedback
    function showCopyFeedback(button, success) {
      const originalText = button.textContent;
      button.textContent = success ? '✓' : '✗';
      button.classList.add(success ? 'success' : 'error');
      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('success', 'error');
      }, 1500);
    }

    // Copy JSON handler
    btnCopyJson.addEventListener('click', () => {
      navigator.clipboard.writeText(exportLogsJson()).then(() => {
        showCopyFeedback(btnCopyJson, true);
      }).catch(() => {
        showCopyFeedback(btnCopyJson, false);
      });
    });

    // Copy Text handler
    btnCopyText.addEventListener('click', () => {
      navigator.clipboard.writeText(exportLogsText()).then(() => {
        showCopyFeedback(btnCopyText, true);
      }).catch(() => {
        showCopyFeedback(btnCopyText, false);
      });
    });

    // Check connection periodically
    setInterval(() => {
      if (channel) {
        try {
          channel.postMessage({
            type: 'PING',
            senderId: 'popout',
            timestamp: Date.now()
          });
        } catch {
          updateStatus(false);
        }
      }
    }, 5000);

    // Filter: Level buttons
    document.querySelectorAll('.filter-level-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const level = e.currentTarget.dataset.level;
        if (filter.levels.has(level)) {
          filter.levels.delete(level);
          e.currentTarget.classList.remove('active');
        } else {
          filter.levels.add(level);
          e.currentTarget.classList.add('active');
        }
        renderAllLogs();
      });
    });

    // Filter: Search input
    filterSearch.addEventListener('input', (e) => {
      filter.search = e.target.value;
      renderAllLogs();
    });

    // Filter: File input
    filterFile.addEventListener('input', (e) => {
      filter.file = e.target.value;
      renderAllLogs();
    });

    // Filter: Clear button
    if (filterClearBtn) {
      filterClearBtn.addEventListener('click', () => {
        // Reset all filters
        filter.levels = new Set(['debug', 'info', 'warn', 'error']);
        filter.search = '';
        filter.file = '';

        // Reset UI elements
        filterSearch.value = '';
        filterFile.value = '';
        document.querySelectorAll('.filter-level-btn').forEach(btn => {
          btn.classList.add('active');
        });

        // Re-render
        renderAllLogs();
      });
    }

    // Timeline: Toggle button
    btnTimeline.addEventListener('click', () => {
      timelineVisible = !timelineVisible;
      timelineContainer.style.display = timelineVisible ? 'block' : 'none';
      btnTimeline.classList.toggle('active', timelineVisible);
      btnTimelinePause.style.display = timelineVisible ? 'inline-block' : 'none';
      if (timelineVisible) {
        timelinePaused = false;
        btnTimelinePause.textContent = '⏸';
        btnTimelinePause.classList.remove('active');
        resizeCanvas();
        drawTimeline();
        startTimelineRefresh();
      } else {
        stopTimelineRefresh();
      }
    });

    // Timeline: Pause/Resume button
    btnTimelinePause.addEventListener('click', () => {
      timelinePaused = !timelinePaused;
      btnTimelinePause.textContent = timelinePaused ? '▶' : '⏸';
      btnTimelinePause.classList.toggle('active', timelinePaused);
      if (timelinePaused) {
        stopTimelineRefresh();
      } else {
        startTimelineRefresh();
      }
    });

    // Timeline: Time window buttons
    document.querySelectorAll('.timeline-btn[data-window]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        timelineWindow = parseInt(e.currentTarget.dataset.window);
        document.querySelectorAll('.timeline-btn[data-window]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        drawTimeline();
      });
    });

    // Timeline: Resize canvas for proper DPI
    function resizeCanvas() {
      const rect = timelineCanvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      timelineCanvas.width = rect.width * dpr;
      timelineCanvas.height = rect.height * dpr;
      const ctx = timelineCanvas.getContext('2d');
      ctx.scale(dpr, dpr);
    }

    // Timeline: Draw the timeline visualization
    function drawTimeline() {
      const ctx = timelineCanvas.getContext('2d');
      const rect = timelineCanvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Clear canvas
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, width, height);

      // Calculate time bounds
      const now = Date.now();
      const startTime = now - timelineWindow;

      // Filter logs within time window
      const visibleLogs = logs.filter(log => log.timestamp >= startTime && log.timestamp <= now);

      // Draw time grid
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      const gridLines = 5;
      for (let i = 0; i <= gridLines; i++) {
        const x = (i / gridLines) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Draw time labels
        const time = new Date(startTime + (i / gridLines) * timelineWindow);
        ctx.fillStyle = '#666';
        ctx.font = '10px monospace';
        ctx.fillText(time.toTimeString().split(' ')[0], x + 3, height - 5);
      }

      // Draw log markers
      const markerHeight = 16;
      const bottomOffset = 20;

      visibleLogs.forEach(log => {
        const x = ((log.timestamp - startTime) / timelineWindow) * width;
        const y = height - bottomOffset - markerHeight / 2;
        const color = LEVEL_COLORS[log.level] || LEVEL_COLORS.debug;

        // Draw marker
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Store bounds for hover
        log._timelineBounds = { x, y, r: 8 };
      });

      // Draw level legend
      ctx.font = '10px monospace';
      let legendX = 10;
      Object.entries(LEVEL_COLORS).forEach(([level, color]) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(legendX, 12, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#888';
        ctx.fillText(level, legendX + 8, 15);
        legendX += ctx.measureText(level).width + 20;
      });
    }

    // Timeline: Mouse move for tooltips
    timelineCanvas.addEventListener('mousemove', (e) => {
      const rect = timelineCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const hoveredLog = logs.find(log => {
        if (!log._timelineBounds) return false;
        const b = log._timelineBounds;
        const dx = x - b.x;
        const dy = y - b.y;
        return Math.sqrt(dx * dx + dy * dy) <= b.r;
      });

      if (hoveredLog) {
        const time = new Date(hoveredLog.timestamp).toTimeString().split(' ')[0];
        timelineTooltip.innerHTML =
          '<strong>[' + hoveredLog.level.toUpperCase() + ']</strong> ' +
          escapeHtml(hoveredLog.message.substring(0, 100)) +
          (hoveredLog.message.length > 100 ? '...' : '') +
          '<br><small>' + time + '</small>';
        timelineTooltip.style.display = 'block';
        timelineTooltip.style.left = Math.min(e.clientX - rect.left + 10, rect.width - 260) + 'px';
        timelineTooltip.style.top = (e.clientY - rect.top - 50) + 'px';
      } else {
        timelineTooltip.style.display = 'none';
      }
    });

    // Timeline: Hide tooltip on mouse leave
    timelineCanvas.addEventListener('mouseleave', () => {
      timelineTooltip.style.display = 'none';
    });

    // Timeline: Start auto-refresh
    function startTimelineRefresh() {
      if (timelineInterval) return;
      timelineInterval = setInterval(() => {
        if (timelineVisible) drawTimeline();
      }, 500);
    }

    // Timeline: Stop auto-refresh
    function stopTimelineRefresh() {
      if (timelineInterval) {
        clearInterval(timelineInterval);
        timelineInterval = null;
      }
    }

    // Handle window resize for timeline
    window.addEventListener('resize', () => {
      if (timelineVisible) {
        resizeCanvas();
        drawTimeline();
      }
    });

    // Initialize
    connect();
  </script>
</body>
</html>`;
}
