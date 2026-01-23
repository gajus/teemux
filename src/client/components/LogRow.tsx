/* eslint-disable react/prop-types */

import { useColumnWidth } from '../contexts/ColumnWidthContext';
import { css, cx } from '../styled-system/css';
import { type LogLine as LogLineType } from '../types';
import {
  extractColorFromPrefix,
  extractJsonFromLine,
  extractLineParts,
  extractProcessName,
  getDefaultColor,
  type JsonValue,
} from '../utils/extractJson';
import { JsonView } from './JsonView';
import { SummaryCapsules } from './SummaryCapsules';
import { type FC, memo, useCallback, useState } from 'react';

type ExtractedData = {
  color: string;
  contentHtml: string;
  json: JsonValue | null;
  processName: null | string;
};

type LogRowProps = {
  readonly displayHtml: string;
  readonly highlights: string[];
  readonly line: LogLineType;
  readonly onTogglePin: (id: string) => void;
  readonly summaryPaths: string[];
};

// Icons
const PinIcon = () => (
  <svg
    fill="none"
    height="14"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width="14"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 17v5" />
    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
  </svg>
);

const ChevronIcon: FC<{ readonly color: string }> = ({ color }) => (
  <svg
    fill="none"
    height="10"
    stroke={color}
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="24"
    viewBox="0 0 256 256"
    width="10"
    xmlns="http://www.w3.org/2000/svg"
  >
    <polyline points="208 96 128 176 48 96" />
  </svg>
);

// Styles
const rowStyles = css({
  '&:hover': {
    background: 'row.expandedBg',
  },
  '&:hover .pin-btn': {
    opacity: 0.5,
  },
  borderRadius: 'sm',
  color: 'text.primary',
  fontFamily: 'mono',
  fontSize: 'sm',
  lineHeight: 'tight',
  overflow: 'hidden',
  position: 'relative',
});

const rowExpandedStyles = css({
  background: 'row.expandedBg',
});

const pinnedStyles = css({
  '& .pin-btn': {
    color: 'text.yellow',
    opacity: 1,
  },
  background: 'bg.pinned',
});

const innerStyles = css({
  alignItems: 'stretch',
  display: 'flex',
  flexFlow: 'row',
  minHeight: '20px',
});

const leftColumnStyles = css({
  alignItems: 'flex-start',
  borderRight: '1px solid',
  borderRightColor: 'border.primary',
  display: 'flex',
  flexShrink: 0,
  gap: '4px',
  overflow: 'hidden',
  padding: '2px 8px',
});

const leftColumnClickableStyles = css({
  cursor: 'pointer',
});

const expandButtonStyles = css({
  alignItems: 'center',
  cursor: 'pointer',
  display: 'flex',
  flexShrink: 0,
  height: '16px',
  justifyContent: 'center',
  userSelect: 'none',
  width: '16px',
});

const expandButtonPlaceholderStyles = css({
  height: '16px',
  width: '16px',
});

const chevronWrapperStyles = css({
  transition: 'transform 0.15s ease',
});

const chevronCollapsedStyles = css({
  transform: 'rotate(-90deg)',
});

const processNameStyles = css({
  color: 'text.muted',
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const rightColumnStyles = css({
  flex: 1,
  minWidth: 0,
  padding: '0 8px',
});

const contentRowStyles = css({
  alignItems: 'center',
  display: 'flex',
  minHeight: '20px',
});

const contentStyles = css({
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const pinButtonStyles = css({
  '&:hover': {
    color: 'text.yellow',
    opacity: '1 !important',
  },
  color: 'text.muted',
  cursor: 'pointer',
  flexShrink: 0,
  opacity: 0,
  padding: '0 4px',
  transition: 'opacity 0.15s',
});

const jsonExpandedAreaStyles = css({
  '& ::selection': {
    background: 'json.selectionBg',
    color: 'text.white',
  },
  borderTop: '1px solid',
  borderTopColor: 'border.primary',
  marginTop: '4px',
  paddingTop: '4px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
});

const summaryOnlyStyles = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
});

// Extract data from line
const extractData = (line: LogLineType): ExtractedData => {
  const extracted = extractJsonFromLine(line.raw, line.html);
  const lineParts = extractLineParts(line.raw, line.html);
  const processName = extractProcessName(line.raw);
  const colorFromHtml = extractColorFromPrefix(line.html);
  const color =
    colorFromHtml || (processName ? getDefaultColor(processName) : '#888');

  return {
    color,
    contentHtml: extracted?.contentHtml ?? lineParts.contentHtml,
    json: extracted?.json ?? null,
    processName,
  };
};

// Build search regex from highlight terms
const buildSearchRegex = (highlights: string[]): RegExp | undefined => {
  const terms = highlights.filter(Boolean);

  if (terms.length === 0) {
    return undefined;
  }

  const escaped = terms.map((term) =>
    term.replaceAll(/([$()*+.?[\\\]^{|}])/gu, '\\$1'),
  );

  return new RegExp(`(${escaped.join('|')})`, 'giu');
};

export const LogRow: FC<LogRowProps> = memo(
  ({ displayHtml, highlights, line, onTogglePin, summaryPaths }) => {
    const [expanded, setExpanded] = useState(false);
    const [activePath, setActivePath] = useState<null | string>(null);
    const { columnWidth } = useColumnWidth();

    const { color, json, processName } = extractData(line);
    const isJsonLine = json !== null;
    const hasSummary = summaryPaths.length > 0;
    const searchQuery = buildSearchRegex(highlights);

    const handleToggleExpanded = useCallback(
      (event: React.MouseEvent) => {
        event.stopPropagation();

        if (isJsonLine) {
          setExpanded((previous) => !previous);
        }
      },
      [isJsonLine],
    );

    const handlePinClick = useCallback(
      (event: React.MouseEvent) => {
        event.stopPropagation();
        onTogglePin(line.id);
      },
      [line.id, onTogglePin],
    );

    const rowClassName = cx(
      'line',
      rowStyles,
      expanded && rowExpandedStyles,
      line.pinned && 'pinned',
      line.pinned && pinnedStyles,
    );

    const borderStyle = {
      borderLeft: `4px solid ${color}`,
    };

    // Render summary capsules inline
    const renderSummaryCapsules = () => {
      if (!hasSummary || !json) {
        return null;
      }

      return (
        <SummaryCapsules
          json={json}
          summaryPaths={summaryPaths}
        />
      );
    };

    // Non-JSON line - simple rendering
    if (!isJsonLine) {
      // Extract content without prefix for display
      const lineParts = extractLineParts(line.raw, displayHtml);

      return (
        <div
          className={rowClassName}
          data-html={line.html}
          data-id={line.id}
          data-raw={line.raw}
          style={{
            ...borderStyle,
            display: line.visible || line.pinned ? '' : 'none',
          }}
        >
          <div className={innerStyles}>
            <div
              className={leftColumnStyles}
              style={{ width: columnWidth }}
            >
              <div className={expandButtonPlaceholderStyles} />
              <span
                className={processNameStyles}
                style={{ color }}
              >
                {processName || ''}
              </span>
            </div>
            <div className={rightColumnStyles}>
              <div className={contentRowStyles}>
                <span
                  className={contentStyles}
                  // eslint-disable-next-line react/no-danger -- Required for rendering HTML log content
                  dangerouslySetInnerHTML={{ __html: lineParts.contentHtml }}
                />
                <span
                  className={cx('pin-btn', pinButtonStyles)}
                  onClick={handlePinClick}
                  title="Pin"
                >
                  <PinIcon />
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // JSON line - two-column layout with expand/collapse
    return (
      <div
        className={rowClassName}
        data-html={line.html}
        data-id={line.id}
        data-raw={line.raw}
        style={{
          ...borderStyle,
          display: line.visible || line.pinned ? '' : 'none',
        }}
      >
        <div className={innerStyles}>
          <div
            className={cx(leftColumnStyles, leftColumnClickableStyles)}
            onClick={handleToggleExpanded}
            style={{ width: columnWidth }}
          >
            <div
              className={expandButtonStyles}
              style={{ backgroundColor: `${color}1A` }}
            >
              <span
                className={cx(
                  chevronWrapperStyles,
                  !expanded && chevronCollapsedStyles,
                )}
              >
                <ChevronIcon color={color} />
              </span>
            </div>
            <span
              className={processNameStyles}
              style={{ color }}
            >
              {processName || ''}
            </span>
          </div>
          <div className={rightColumnStyles}>
            {expanded ? (
              <>
                {hasSummary && (
                  <div className={contentRowStyles}>
                    <div className={summaryOnlyStyles}>
                      {renderSummaryCapsules()}
                    </div>
                    <span
                      className={cx('pin-btn', pinButtonStyles)}
                      onClick={handlePinClick}
                      title="Pin"
                    >
                      <PinIcon />
                    </span>
                  </div>
                )}
                <div
                  className={hasSummary ? jsonExpandedAreaStyles : undefined}
                >
                  <JsonView
                    activePath={activePath}
                    data={json}
                    expanded
                    onActivePathChange={setActivePath}
                    searchQuery={searchQuery}
                  />
                </div>
              </>
            ) : (
              <div className={contentRowStyles}>
                <div className={contentStyles}>
                  {hasSummary ? (
                    <div className={summaryOnlyStyles}>
                      {renderSummaryCapsules()}
                    </div>
                  ) : (
                    <JsonView
                      activePath={null}
                      data={json}
                      expanded={false}
                      onActivePathChange={() => {}}
                      searchQuery={searchQuery}
                    />
                  )}
                </div>
                <span
                  className={cx('pin-btn', pinButtonStyles)}
                  onClick={handlePinClick}
                  title="Pin"
                >
                  <PinIcon />
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);

LogRow.displayName = 'LogRow';
