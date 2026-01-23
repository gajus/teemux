import { useColumnWidth } from '../contexts/ColumnWidthContext';
import { css } from '../styled-system/css';
import { type LogLine as LogLineType } from '../types';
import { extractJsonFromLine, extractLineParts } from '../utils/extractJson';
import {
  highlightTerms,
  insertCapsulesAfterPrefix,
} from '../utils/highlighting';
import { buildSummaryCapsules } from '../utils/summary';
import { LogRow } from './LogRow';
import { forwardRef, useCallback, useMemo, useRef, useState } from 'react';

type LogContainerProps = {
  readonly highlights: string[];
  readonly includes: string[];
  readonly lines: LogLineType[];
  readonly onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  readonly onTogglePin: (id: string) => void;
  readonly summaryPaths: string[];
};

const wrapperStyles = css({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  overflow: 'hidden',
});

const headerStyles = css({
  alignItems: 'center',
  borderBottom: '1px solid',
  borderBottomColor: 'border.primary',
  display: 'flex',
  flexShrink: 0,
  fontSize: 'xs',
  height: '24px',
  paddingLeft: '16px',
});

const headerLeftColumnStyles = css({
  alignItems: 'center',
  borderRight: '1px solid',
  borderRightColor: 'border.primary',
  color: 'text.muted',
  display: 'flex',
  flexShrink: 0,
  height: '100%',
  justifyContent: 'space-between',
  padding: '0 8px 0 0',
  position: 'relative',
  userSelect: 'none',
});

const headerLabelStyles = css({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const resizeHandleStyles = css({
  '&:hover': {
    background: 'accent.blue',
  },
  background: 'transparent',
  cursor: 'col-resize',
  height: '100%',
  position: 'absolute',
  right: '-2px',
  top: 0,
  width: '4px',
  zIndex: 10,
});

const resizeHandleActiveStyles = css({
  background: 'accent.blue',
});

const headerRightColumnStyles = css({
  color: 'text.muted',
  flex: 1,
  padding: '0 8px',
});

const containerStyles = css({
  flex: 1,
  overflowY: 'auto',
  padding: '0 12px 8px',
});

export const LogContainer = forwardRef<HTMLDivElement, LogContainerProps>(
  (
    { highlights, includes, lines, onScroll, onTogglePin, summaryPaths },
    ref,
  ) => {
    const { columnWidth, setColumnWidth } = useColumnWidth();
    const [isResizing, setIsResizing] = useState(false);
    const startXRef = useRef(0);
    const startWidthRef = useRef(0);

    const handleMouseDown = useCallback(
      (event: React.MouseEvent) => {
        event.preventDefault();
        setIsResizing(true);
        startXRef.current = event.clientX;
        startWidthRef.current = columnWidth;

        const handleMouseMove = (moveEvent: MouseEvent) => {
          const delta = moveEvent.clientX - startXRef.current;
          setColumnWidth(startWidthRef.current + delta);
        };

        const handleMouseUp = () => {
          setIsResizing(false);
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      },
      [columnWidth, setColumnWidth],
    );

    const processedLines = useMemo(() => {
      return lines.map((line) => {
        // Check if this is a JSON line
        const isJsonLine = extractJsonFromLine(line.raw, line.html) !== null;

        let displayHtml = line.html;
        // Apply highlighting for include filter (green marks)
        displayHtml = highlightTerms(displayHtml, includes, 'filter');

        // For non-JSON lines, apply all HTML processing
        // For JSON lines, LogRow handles JSON rendering internally
        if (!isJsonLine) {
          displayHtml = highlightTerms(displayHtml, highlights);
          const capsules = buildSummaryCapsules(line.raw, summaryPaths);
          // Extract content only (without prefix) and insert capsules
          const lineParts = extractLineParts(line.raw, displayHtml);
          const contentWithCapsules = insertCapsulesAfterPrefix(
            lineParts.contentHtml,
            capsules,
          );
          // Reconstruct displayHtml with prefix + content
          displayHtml = lineParts.prefixHtml + contentWithCapsules;
        }

        return { ...line, displayHtml };
      });
    }, [highlights, includes, lines, summaryPaths]);

    return (
      <div className={wrapperStyles}>
        <div className={headerStyles}>
          <div
            className={headerLeftColumnStyles}
            style={{ width: columnWidth }}
          >
            <span className={headerLabelStyles}>Source</span>
            <div
              className={`${resizeHandleStyles} ${isResizing ? resizeHandleActiveStyles : ''}`}
              onMouseDown={handleMouseDown}
            />
          </div>
          <div className={headerRightColumnStyles}>Content</div>
        </div>
        <div
          className={containerStyles}
          onScroll={onScroll}
          ref={ref}
        >
          {processedLines.map((line) => (
            <LogRow
              displayHtml={line.displayHtml}
              highlights={highlights}
              key={line.id}
              line={line}
              onTogglePin={onTogglePin}
              summaryPaths={summaryPaths}
            />
          ))}
        </div>
      </div>
    );
  },
);

LogContainer.displayName = 'LogContainer';
