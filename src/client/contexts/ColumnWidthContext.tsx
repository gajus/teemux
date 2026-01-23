import {
  createContext,
  type FC,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

type ColumnWidthContextValue = {
  columnWidth: number;
  setColumnWidth: (width: number) => void;
};

const ColumnWidthContext = createContext<ColumnWidthContextValue | null>(null);

const MIN_COLUMN_WIDTH = 80;
const MAX_COLUMN_WIDTH = 400;
const DEFAULT_COLUMN_WIDTH = 150;

export const ColumnWidthProvider: FC<{ readonly children: ReactNode }> = ({
  children,
}) => {
  // eslint-disable-next-line react/hook-use-state -- Need to wrap setter with validation
  const [columnWidth, setColumnWidthRaw] = useState(DEFAULT_COLUMN_WIDTH);

  const setColumnWidth = useCallback((width: number) => {
    setColumnWidthRaw(
      Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, width)),
    );
  }, []);

  const value = useMemo(
    () => ({ columnWidth, setColumnWidth }),
    [columnWidth, setColumnWidth],
  );

  return (
    <ColumnWidthContext.Provider value={value}>
      {children}
    </ColumnWidthContext.Provider>
  );
};

export const useColumnWidth = (): ColumnWidthContextValue => {
  const context = useContext(ColumnWidthContext);

  if (!context) {
    throw new Error('useColumnWidth must be used within ColumnWidthProvider');
  }

  return context;
};
