import { FilterBar } from './components/FilterBar';
import { LogContainer } from './components/LogContainer';
import { TailButton } from './components/TailButton';
import { ColumnWidthProvider } from './contexts/ColumnWidthContext';
import { useLogState } from './hooks/useLogState';
import { type PendingLine } from './types';
import { parseFilterValue } from './utils/filtering';
import { useCallback, useEffect, useRef, useState } from 'react';

declare const pendingLines: PendingLine[];
declare function registerHandlers(
  addLine: (html: string, raw: string) => void,
  clearLogs: () => void,
): void;

export const App = () => {
  const { addLine, applyFilters, clearLogs, setTailing, state, togglePin } =
    useLogState();
  const containerRef = useRef<HTMLDivElement>(null);
  const [clearActive, setClearActive] = useState(false);

  // Local filter state for controlled inputs
  const [includeFilter, setIncludeFilter] = useState(state.includeFilter);
  const [excludeFilter, setExcludeFilter] = useState(state.excludeFilter);
  const [highlightFilter, setHighlightFilter] = useState(state.highlightFilter);
  const [summaryFilter, setSummaryFilter] = useState(state.summaryFilter);

  // Debounce timer ref
  const debounceTimerRef = useRef<null | ReturnType<typeof setTimeout>>(null);

  // Register handlers and flush pending lines on mount
  useEffect(() => {
    registerHandlers(addLine, clearLogs);

    // Flush any pending lines
    for (const line of pendingLines) {
      addLine(line.html, line.raw);
    }

    pendingLines.length = 0;
  }, [addLine, clearLogs]);

  // Auto-scroll when tailing
  useEffect(() => {
    if (state.tailing && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [state.lines, state.tailing]);

  // Handle scroll to detect tailing
  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      const atBottom =
        target.scrollHeight - target.scrollTop - target.clientHeight < 50;
      setTailing(atBottom);
    },
    [setTailing],
  );

  // Handle tail button click
  const handleTailClick = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }

    setTailing(true);
  }, [setTailing]);

  // Handle clear button click
  const handleClear = useCallback(() => {
    setClearActive(true);
    fetch('/clear', { method: 'POST' });
    setTimeout(() => setClearActive(false), 150);
  }, []);

  // Keyboard shortcut for clear
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        handleClear();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClear]);

  // Debounced filter application
  const applyFiltersDebounced = useCallback(
    (
      include: string,
      exclude: string,
      highlight: string,
      summary: string,
      delay: number,
    ) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        void applyFilters(include, exclude, highlight, summary);
      }, delay);
    },
    [applyFilters],
  );

  // Filter change handlers
  const handleIncludeChange = useCallback(
    (value: string) => {
      setIncludeFilter(value);
      applyFiltersDebounced(
        value,
        excludeFilter,
        highlightFilter,
        summaryFilter,
        300,
      );
    },
    [applyFiltersDebounced, excludeFilter, highlightFilter, summaryFilter],
  );

  const handleExcludeChange = useCallback(
    (value: string) => {
      setExcludeFilter(value);
      applyFiltersDebounced(
        includeFilter,
        value,
        highlightFilter,
        summaryFilter,
        300,
      );
    },
    [applyFiltersDebounced, highlightFilter, includeFilter, summaryFilter],
  );

  const handleHighlightChange = useCallback(
    (value: string) => {
      setHighlightFilter(value);
      applyFiltersDebounced(
        includeFilter,
        excludeFilter,
        value,
        summaryFilter,
        150,
      );
    },
    [applyFiltersDebounced, excludeFilter, includeFilter, summaryFilter],
  );

  const handleSummaryChange = useCallback(
    (value: string) => {
      setSummaryFilter(value);
      applyFiltersDebounced(
        includeFilter,
        excludeFilter,
        highlightFilter,
        value,
        150,
      );
    },
    [applyFiltersDebounced, excludeFilter, highlightFilter, includeFilter],
  );

  const includes = parseFilterValue(includeFilter);
  const highlights = parseFilterValue(highlightFilter);
  const summaryPaths = parseFilterValue(summaryFilter);

  return (
    <ColumnWidthProvider>
      <FilterBar
        clearActive={clearActive}
        excludeFilter={excludeFilter}
        highlightFilter={highlightFilter}
        includeFilter={includeFilter}
        onClear={handleClear}
        onExcludeChange={handleExcludeChange}
        onHighlightChange={handleHighlightChange}
        onIncludeChange={handleIncludeChange}
        onSummaryChange={handleSummaryChange}
        summaryFilter={summaryFilter}
      />
      <LogContainer
        highlights={highlights}
        includes={includes}
        lines={state.lines}
        onScroll={handleScroll}
        onTogglePin={togglePin}
        ref={containerRef}
        summaryPaths={summaryPaths}
      />
      <TailButton
        onClick={handleTailClick}
        visible={!state.tailing}
      />
    </ColumnWidthProvider>
  );
};
