import { type LogLine as LogLineType } from '../types';
import {
  highlightTerms,
  insertCapsulesAfterPrefix,
} from '../utils/highlighting';
import { buildSummaryCapsules } from '../utils/summary';
import { LogLine } from './LogLine';
import { forwardRef, useMemo } from 'react';

type LogContainerProps = {
  readonly highlights: string[];
  readonly includes: string[];
  readonly lines: LogLineType[];
  readonly onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  readonly onTogglePin: (id: string) => void;
  readonly summaryPaths: string[];
};

export const LogContainer = forwardRef<HTMLDivElement, LogContainerProps>(
  (
    { highlights, includes, lines, onScroll, onTogglePin, summaryPaths },
    ref,
  ) => {
    const processedLines = useMemo(() => {
      return lines.map((line) => {
        let displayHtml = line.html;
        displayHtml = highlightTerms(displayHtml, includes, 'filter');
        displayHtml = highlightTerms(displayHtml, highlights);
        const capsules = buildSummaryCapsules(line.raw, summaryPaths);
        displayHtml = insertCapsulesAfterPrefix(displayHtml, capsules);
        return { ...line, displayHtml };
      });
    }, [highlights, includes, lines, summaryPaths]);

    return (
      <div
        id="container"
        onScroll={onScroll}
        ref={ref}
      >
        {processedLines.map((line) => (
          <LogLine
            displayHtml={line.displayHtml}
            key={line.id}
            line={line}
            onTogglePin={onTogglePin}
          />
        ))}
      </div>
    );
  },
);

LogContainer.displayName = 'LogContainer';
