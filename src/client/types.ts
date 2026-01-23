export type LogAction =
  | {
      excludeFilter: string;
      highlightFilter: string;
      includeFilter: string;
      summaryFilter: string;
      type: 'SET_FILTERS';
    }
  | { html: string; raw: string; type: 'ADD_LINE' }
  | { id: string; type: 'TOGGLE_PIN' }
  | { lines: Array<{ html: string; raw: string }>; type: 'SET_LINES' }
  | { tailing: boolean; type: 'SET_TAILING' }
  | { type: 'APPLY_FILTERS' }
  | { type: 'CLEAR_LOGS' };

export type LogLine = {
  html: string;
  id: string;
  pinned: boolean;
  raw: string;
  visible: boolean;
};

export type LogState = {
  excludeFilter: string;
  highlightFilter: string;
  includeFilter: string;
  lines: LogLine[];
  summaryFilter: string;
  tailing: boolean;
};

export type PendingLine = {
  html: string;
  raw: string;
};
