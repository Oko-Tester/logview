/**
 * Pop-out Window Manager
 *
 * Handles:
 * - Opening pop-out window
 * - Synchronizing logs via BroadcastChannel
 * - Maintaining connection when main app crashes
 */

import { channel, type ChannelMessage } from '../channel/broadcast';
import { logger } from '../core/logger';

/** Pop-out window dimensions */
const POPOUT_WIDTH = 500;
const POPOUT_HEIGHT = 700;

/** Pop-out window reference */
let popoutWindow: Window | null = null;

/** Check if we're running inside the pop-out window */
export function isPopoutWindow(): boolean {
  try {
    return window.name === 'devlogger-popout';
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
      '',
      'devlogger-popout',
      `width=${POPOUT_WIDTH},height=${POPOUT_HEIGHT},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!popoutWindow) {
      console.warn('[DevLogger] Pop-out blocked by browser');
      return null;
    }

    // Write content to window
    popoutWindow.document.write(popoutHtml);
    popoutWindow.document.close();

    // Send initial sync after window loads
    popoutWindow.addEventListener('load', () => {
      // Give the pop-out time to set up its channel listener
      setTimeout(() => {
        channel.sendSyncResponse(logger.getLogs());
      }, 100);
    });

    return popoutWindow;
  } catch (e) {
    console.warn('[DevLogger] Failed to open pop-out:', e);
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
    if (message.type === 'SYNC_REQUEST') {
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
      <button class="btn" id="btn-clear">Clear</button>
    </div>
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

    // DOM elements
    const logsContainer = document.getElementById('logs');
    const logCountBadge = document.getElementById('log-count');
    const footerCount = document.getElementById('footer-count');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const btnClear = document.getElementById('btn-clear');

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
      renderLog(log);
      updateCounts();
      scrollToBottom();
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

    // Render all logs
    function renderAllLogs() {
      if (logs.length === 0) {
        logsContainer.innerHTML = '<div class="empty">No logs yet...</div>';
        return;
      }

      logsContainer.innerHTML = '';
      logs.forEach(log => renderLog(log));
      scrollToBottom();
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

    // Initialize
    connect();
  </script>
</body>
</html>`;
}
