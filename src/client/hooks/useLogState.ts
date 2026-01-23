import { type LogAction, type LogLine, type LogState } from '../types';
import { matchesFilters, parseFilterValue } from '../utils/filtering';
import { useCallback, useReducer, useRef } from 'react';

declare const tailSize: number;

const getEffectiveTailSize = (): number => {
  if (typeof tailSize === 'undefined') {
    return 1_000;
  }

  return Math.min(tailSize, 1_000);
};

let lineCounter = 0;

const createLogLine = (html: string, raw: string): LogLine => {
  const id = 'line-' + lineCounter++;
  return {
    html,
    id,
    pinned: false,
    raw,
    visible: true,
  };
};

const computeVisibility = (
  line: LogLine,
  includes: string[],
  excludes: string[],
): LogLine => {
  const visible = matchesFilters(line.raw, includes, excludes);
  return { ...line, visible };
};

const trimLines = (lines: LogLine[]): LogLine[] => {
  const effectiveTailSize = getEffectiveTailSize();
  const pinnedLines = lines.filter((line) => line.pinned);
  const unpinnedLines = lines.filter((line) => !line.pinned);

  if (unpinnedLines.length > effectiveTailSize) {
    const excess = unpinnedLines.length - effectiveTailSize;
    const trimmedUnpinned = unpinnedLines.slice(excess);
    // Maintain order: pinned lines first, then unpinned
    return [...pinnedLines, ...trimmedUnpinned].toSorted((a, b) => {
      const aNumber = Number.parseInt(a.id.replace('line-', ''), 10);
      const bNumber = Number.parseInt(b.id.replace('line-', ''), 10);
      return aNumber - bNumber;
    });
  }

  return lines;
};

const logReducer = (state: LogState, action: LogAction): LogState => {
  const includes = parseFilterValue(state.includeFilter);
  const excludes = parseFilterValue(state.excludeFilter);

  switch (action.type) {
    case 'ADD_LINE': {
      const newLine = createLogLine(action.html, action.raw);
      const visibleLine = computeVisibility(newLine, includes, excludes);
      const newLines = trimLines([...state.lines, visibleLine]);
      return { ...state, lines: newLines };
    }

    case 'APPLY_FILTERS': {
      const newLines = state.lines.map((line) =>
        computeVisibility(line, includes, excludes),
      );
      return { ...state, lines: newLines };
    }

    case 'CLEAR_LOGS': {
      lineCounter = 0;
      return { ...state, lines: [] };
    }

    case 'SET_FILTERS': {
      const newIncludes = parseFilterValue(action.includeFilter);
      const newExcludes = parseFilterValue(action.excludeFilter);
      const newLines = state.lines.map((line) =>
        computeVisibility(line, newIncludes, newExcludes),
      );
      return {
        ...state,
        excludeFilter: action.excludeFilter,
        highlightFilter: action.highlightFilter,
        includeFilter: action.includeFilter,
        lines: newLines,
        summaryFilter: action.summaryFilter,
      };
    }

    case 'SET_LINES': {
      // Preserve pinned lines from current state
      const pinnedLines = state.lines.filter((line) => line.pinned);
      const newLines = action.lines.map((item) => {
        const line = createLogLine(item.html, item.raw);
        return computeVisibility(line, includes, excludes);
      });
      // Combine pinned lines with new lines, maintaining sort order by id
      const combinedLines = [...pinnedLines, ...newLines].toSorted((a, b) => {
        const aNumber = Number.parseInt(a.id.replace('line-', ''), 10);
        const bNumber = Number.parseInt(b.id.replace('line-', ''), 10);
        return aNumber - bNumber;
      });
      return { ...state, lines: combinedLines };
    }

    case 'SET_TAILING': {
      return { ...state, tailing: action.tailing };
    }

    case 'TOGGLE_PIN': {
      const newLines = state.lines.map((line) =>
        line.id === action.id ? { ...line, pinned: !line.pinned } : line,
      );
      return { ...state, lines: newLines };
    }

    default:
      return state;
  }
};

const getInitialState = (): LogState => {
  const parameters = new URLSearchParams(window.location.search);
  return {
    excludeFilter: parameters.get('exclude') || '',
    highlightFilter: parameters.get('highlight') || '',
    includeFilter: parameters.get('include') || '',
    lines: [],
    summaryFilter: parameters.get('summary') || '',
    tailing: true,
  };
};

export const useLogState = () => {
  const [state, dispatch] = useReducer(logReducer, null, getInitialState);
  const lastSearchQueryRef = useRef('');
  const searchControllerRef = useRef<AbortController | null>(null);

  const addLine = useCallback((html: string, raw: string) => {
    dispatch({ html, raw, type: 'ADD_LINE' });
  }, []);

  const clearLogs = useCallback(() => {
    dispatch({ type: 'CLEAR_LOGS' });
  }, []);

  const togglePin = useCallback((id: string) => {
    dispatch({ id, type: 'TOGGLE_PIN' });
  }, []);

  const setTailing = useCallback((tailing: boolean) => {
    dispatch({ tailing, type: 'SET_TAILING' });
  }, []);

  const applyFilters = useCallback(
    async (
      includeFilter: string,
      excludeFilter: string,
      highlightFilter: string,
      summaryFilter: string,
    ) => {
      // Update URL without reload
      const newParameters = new URLSearchParams();
      if (includeFilter) {
        newParameters.set('include', includeFilter);
      }

      if (excludeFilter) {
        newParameters.set('exclude', excludeFilter);
      }

      if (highlightFilter) {
        newParameters.set('highlight', highlightFilter);
      }

      if (summaryFilter) {
        newParameters.set('summary', summaryFilter);
      }

      const newUrl = newParameters.toString()
        ? '?' + newParameters.toString()
        : window.location.pathname;
      history.replaceState(null, '', newUrl);

      // Build search query string for comparison
      const searchQuery = includeFilter + '|' + excludeFilter;

      // If only highlight/summary changed, just update filters locally
      if (searchQuery === lastSearchQueryRef.current) {
        dispatch({
          excludeFilter,
          highlightFilter,
          includeFilter,
          summaryFilter,
          type: 'SET_FILTERS',
        });
        return;
      }

      lastSearchQueryRef.current = searchQuery;

      // Cancel any pending search request
      if (searchControllerRef.current) {
        searchControllerRef.current.abort();
      }

      const includes = parseFilterValue(includeFilter);
      const excludes = parseFilterValue(excludeFilter);

      // If no filters, just apply local filtering
      if (includes.length === 0 && excludes.length === 0) {
        dispatch({
          excludeFilter,
          highlightFilter,
          includeFilter,
          summaryFilter,
          type: 'SET_FILTERS',
        });
        return;
      }

      // Fetch matching logs from server
      searchControllerRef.current = new AbortController();
      const searchParameters = new URLSearchParams();
      if (includeFilter) {
        searchParameters.set('include', includeFilter);
      }

      if (excludeFilter) {
        searchParameters.set('exclude', excludeFilter);
      }

      searchParameters.set('limit', '1000');

      try {
        const response = await fetch('/search?' + searchParameters.toString(), {
          signal: searchControllerRef.current.signal,
        });
        const results = (await response.json()) as Array<{
          html: string;
          raw: string;
        }>;

        // Keep pinned lines, replace rest with search results
        dispatch({
          excludeFilter,
          highlightFilter,
          includeFilter,
          summaryFilter,
          type: 'SET_FILTERS',
        });
        dispatch({ lines: results, type: 'SET_LINES' });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          // eslint-disable-next-line no-console
          console.error('Search failed:', error);
          // Fallback to local filtering
          dispatch({
            excludeFilter,
            highlightFilter,
            includeFilter,
            summaryFilter,
            type: 'SET_FILTERS',
          });
        }
      }
    },
    [],
  );

  return {
    addLine,
    applyFilters,
    clearLogs,
    setTailing,
    state,
    togglePin,
  };
};
