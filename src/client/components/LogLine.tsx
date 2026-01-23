import { css, cx } from '../styled-system/css';
import { type LogLine as LogLineType } from '../types';

type LogLineProps = {
  readonly displayHtml: string;
  readonly line: LogLineType;
  readonly onTogglePin: (id: string) => void;
};

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

const lineStyles = css({
  '&:hover': {
    background: 'rgba(255, 255, 255, 0.05)',
  },
  '&:hover .pin-btn': {
    opacity: 0.5,
  },
  alignItems: 'flex-start',
  borderRadius: '2px',
  display: 'flex',
  margin: '0 -4px',
  padding: '1px 4px',
  position: 'relative',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
});

const pinnedStyles = css({
  '& .pin-btn': {
    color: '#fc0',
    opacity: 1,
  },
  background: 'rgba(255, 204, 0, 0.1)',
  borderLeft: '2px solid #fc0',
  marginLeft: '-6px',
  paddingLeft: '6px',
});

const lineContentStyles = css({
  flex: 1,
});

const pinButtonStyles = css({
  '&:hover': {
    color: '#fc0',
    opacity: '1 !important',
  },
  color: '#888',
  cursor: 'pointer',
  flexShrink: 0,
  opacity: 0,
  padding: '0 4px',
  transition: 'opacity 0.15s',
});

export const LogLine = ({ displayHtml, line, onTogglePin }: LogLineProps) => {
  const handlePinClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onTogglePin(line.id);
  };

  return (
    <div
      className={cx(
        'line',
        lineStyles,
        line.pinned && 'pinned',
        line.pinned && pinnedStyles,
      )}
      data-html={line.html}
      data-id={line.id}
      data-raw={line.raw}
      style={{ display: line.visible || line.pinned ? '' : 'none' }}
    >
      <span
        className={cx('line-content', lineContentStyles)}
        // eslint-disable-next-line react/no-danger -- Required for rendering HTML log content
        dangerouslySetInnerHTML={{ __html: displayHtml }}
      />
      <span
        className={cx('pin-btn', pinButtonStyles)}
        onClick={handlePinClick}
        title="Pin"
      >
        <PinIcon />
      </span>
    </div>
  );
};
