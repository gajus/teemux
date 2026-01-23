import { App } from './App';
import { type PendingLine } from './types';
import { createRoot } from 'react-dom/client';
// eslint-disable-next-line import/no-unassigned-import
import './styled-system/styles.css';

// Global state for the function bridge
let addLineHandler: ((html: string, raw: string) => void) | null = null;
let clearLogsHandler: (() => void) | null = null;
const pendingLines: PendingLine[] = [];

// Expose global functions BEFORE React renders
// The server sends <script>addLine(...)</script> tags
(window as unknown as Record<string, unknown>).addLine = (
  html: string,
  raw: string,
) => {
  if (addLineHandler) {
    addLineHandler(html, raw);
  } else {
    pendingLines.push({ html, raw });
  }
};

(window as unknown as Record<string, unknown>).clearLogs = () => {
  clearLogsHandler?.();
};

// Export pendingLines and registerHandlers for App to use
(window as unknown as Record<string, unknown>).pendingLines = pendingLines;
(window as unknown as Record<string, unknown>).registerHandlers = (
  addLine: (html: string, raw: string) => void,
  clearLogs: () => void,
) => {
  addLineHandler = addLine;
  clearLogsHandler = clearLogs;
};

// Render React app
const container = document.querySelector('#root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
