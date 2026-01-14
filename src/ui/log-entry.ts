/**
 * Log Entry Renderer
 *
 * Renders a single log entry with:
 * - Level badge (color-coded)
 * - Timestamp
 * - Source location
 * - Message
 * - Expandable data
 */

import type { LogEvent } from '../core/types';

/**
 * Format timestamp for display (HH:MM:SS.mmm)
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Format source location for display
 */
function formatSource(source: LogEvent['source']): string {
  if (source.file === 'unknown') {
    return 'unknown';
  }
  return `${source.file}:${source.line}`;
}

/**
 * Safely stringify data for display
 */
function formatData(data: unknown[]): string {
  if (data.length === 0) {
    return '';
  }

  try {
    return data
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        return JSON.stringify(item, null, 2);
      })
      .join('\n');
  } catch {
    return '[Unable to display data]';
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Create a log entry DOM element
 */
export function createLogEntry(log: LogEvent): HTMLElement {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.dataset.id = log.id;

  const hasData = log.data.length > 0;
  const dataId = `data-${log.id}`;

  entry.innerHTML = `
    <div class="log-entry-header">
      <span class="log-level log-level-${log.level}">${log.level}</span>
      <span class="log-time">${formatTime(log.timestamp)}</span>
      <span class="log-source" title="${escapeHtml(formatSource(log.source))}">${escapeHtml(formatSource(log.source))}</span>
    </div>
    <div class="log-message">${escapeHtml(log.message)}</div>
    ${
      hasData
        ? `
      <div class="log-data">
        <button class="log-data-toggle" data-target="${dataId}">
          ${log.data.length} item${log.data.length > 1 ? 's' : ''}
        </button>
        <pre class="log-data-content" id="${dataId}">${escapeHtml(formatData(log.data))}</pre>
      </div>
    `
        : ''
    }
  `;

  // Add click handler for data toggle
  if (hasData) {
    const toggle = entry.querySelector('.log-data-toggle');
    const content = entry.querySelector(`#${dataId}`);

    if (toggle && content) {
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('expanded');
        content.classList.toggle('visible');
      });
    }
  }

  return entry;
}

/**
 * Create the empty state element
 */
export function createEmptyState(): HTMLElement {
  const empty = document.createElement('div');
  empty.className = 'devlogger-empty';
  empty.textContent = 'No logs yet...';
  return empty;
}
