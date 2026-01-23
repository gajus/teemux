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

export const TailButton = ({ onClick, visible }: TailButtonProps) => {
  return (
    <button
      id="tail-btn"
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
