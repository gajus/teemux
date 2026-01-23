import { css } from '../styled-system/css';
import { ClearButton } from './ClearButton';

type FilterBarProps = {
  readonly clearActive: boolean;
  readonly excludeFilter: string;
  readonly highlightFilter: string;
  readonly includeFilter: string;
  readonly onClear: () => void;
  readonly onExcludeChange: (value: string) => void;
  readonly onHighlightChange: (value: string) => void;
  readonly onIncludeChange: (value: string) => void;
  readonly onSummaryChange: (value: string) => void;
  readonly summaryFilter: string;
};

const filterBarStyles = css({
  '& input': {
    '&:focus': {
      borderColor: '#007acc',
      outline: 'none',
    },
    background: '#1e1e1e',
    border: '1px solid #3c3c3c',
    borderRadius: '3px',
    color: '#d4d4d4',
    fontFamily: 'inherit',
    fontSize: '12px',
    padding: '4px 8px',
    width: '200px',
  },
  '& label': {
    alignItems: 'center',
    color: '#888',
    display: 'flex',
    gap: '6px',
  },
  background: '#252526',
  borderBottom: '1px solid #3c3c3c',
  display: 'flex',
  flexShrink: 0,
  gap: '8px',
  padding: '8px 12px',
});

export const FilterBar = ({
  clearActive,
  excludeFilter,
  highlightFilter,
  includeFilter,
  onClear,
  onExcludeChange,
  onHighlightChange,
  onIncludeChange,
  onSummaryChange,
  summaryFilter,
}: FilterBarProps) => {
  return (
    <div className={filterBarStyles}>
      <label>
        Include:{' '}
        <input
          id="include"
          onChange={(event) => onIncludeChange(event.target.value)}
          placeholder="error*,warn* (OR, * = wildcard)"
          type="text"
          value={includeFilter}
        />
      </label>
      <label>
        Exclude:{' '}
        <input
          id="exclude"
          onChange={(event) => onExcludeChange(event.target.value)}
          placeholder="health*,debug (OR, * = wildcard)"
          type="text"
          value={excludeFilter}
        />
      </label>
      <label>
        Highlight:{' '}
        <input
          id="highlight"
          onChange={(event) => onHighlightChange(event.target.value)}
          placeholder="term1,term2"
          type="text"
          value={highlightFilter}
        />
      </label>
      <label>
        Summary:{' '}
        <input
          id="summary"
          onChange={(event) => onSummaryChange(event.target.value)}
          placeholder="level,message,error.code"
          type="text"
          value={summaryFilter}
        />
      </label>
      <ClearButton
        active={clearActive}
        onClick={onClear}
      />
    </div>
  );
};
