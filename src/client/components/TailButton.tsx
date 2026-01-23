import { css } from '../styled-system/css';

type TailButtonProps = {
  readonly onClick: () => void;
  readonly visible: boolean;
};

const TailIcon = () => (
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
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  </svg>
);

const tailButtonStyles = css({
  '&:hover': {
    background: '#0098ff',
  },
  '& svg': {
    flexShrink: 0,
  },
  alignItems: 'center',
  background: '#007acc',
  border: 'none',
  borderRadius: '4px',
  bottom: '20px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  color: '#fff',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '12px',
  gap: '6px',
  padding: '8px 16px',
  position: 'fixed',
  right: '20px',
  transition: 'background 0.15s',
});

export const TailButton = ({ onClick, visible }: TailButtonProps) => {
  return (
    <button
      className={tailButtonStyles}
      onClick={onClick}
      style={{ display: visible ? 'flex' : 'none' }}
      title="Jump to bottom and follow new logs"
      type="button"
    >
      <TailIcon />
      Tail
    </button>
  );
};
