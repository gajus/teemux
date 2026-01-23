import { css, cx } from '../styled-system/css';

type ClearButtonProps = {
  readonly active: boolean;
  readonly onClick: () => void;
};

const TrashIcon = () => (
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
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line
      x1="10"
      x2="10"
      y1="11"
      y2="17"
    />
    <line
      x1="14"
      x2="14"
      y1="11"
      y2="17"
    />
  </svg>
);

const clearButtonStyles = css({
  '&:hover': {
    background: '#3c3c3c',
    borderColor: '#505050',
    color: '#d4d4d4',
  },
  '& svg': {
    flexShrink: 0,
  },
  alignItems: 'center',
  background: 'transparent',
  border: '1px solid #3c3c3c',
  borderRadius: '4px',
  color: '#888',
  cursor: 'pointer',
  display: 'flex',
  fontFamily: 'inherit',
  fontSize: '12px',
  gap: '5px',
  marginLeft: 'auto',
  padding: '4px 10px',
  transition: 'all 0.15s',
});

const activeButtonStyles = css({
  background: '#264f78',
  borderColor: '#007acc',
  boxShadow: '0 0 0 2px rgba(0, 122, 204, 0.3)',
  color: '#fff',
});

export const ClearButton = ({ active, onClick }: ClearButtonProps) => {
  return (
    <button
      className={cx(clearButtonStyles, active && activeButtonStyles)}
      id="clear-btn"
      onClick={onClick}
      title="Clear all logs (Cmd+K)"
      type="button"
    >
      <TrashIcon />
      Clear
    </button>
  );
};
