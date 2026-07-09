import { useCallback, useMemo, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

const COLUMN_MIN_WIDTH = 72;
const COLUMN_MAX_WIDTH = 720;
const COLUMN_DEFAULT_WIDTH = 150;

const clampColumnWidth = (width: number): number => {
  return Math.min(Math.max(width, COLUMN_MIN_WIDTH), COLUMN_MAX_WIDTH);
};

const getDefaultColumnWidth = (column: string): number => {
  return clampColumnWidth(
    Math.max(COLUMN_DEFAULT_WIDTH, column.length * 9 + 32),
  );
};

export const useResultColumnSizing = (
  columns: string[],
  fixedWidth: number,
) => {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  const getColumnWidth = useCallback(
    (column: string): number => {
      return columnWidths[column] ?? getDefaultColumnWidth(column);
    },
    [columnWidths],
  );

  const resultGridStyle = useMemo(() => {
    const gridWidth =
      fixedWidth +
      columns.reduce((totalWidth, column) => {
        return totalWidth + getColumnWidth(column);
      }, 0);

    return {
      width: `${gridWidth}px`,
    } as CSSProperties;
  }, [columns, fixedWidth, getColumnWidth]);

  const handleColumnResizeStart = useCallback(
    (column: string, event: ReactPointerEvent<HTMLSpanElement>): void => {
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startWidth = getColumnWidth(column);

      const handlePointerMove = (moveEvent: PointerEvent): void => {
        const nextWidth = clampColumnWidth(
          startWidth + moveEvent.clientX - startX,
        );

        setColumnWidths((currentWidths) => ({
          ...currentWidths,
          [column]: nextWidth,
        }));
      };

      const handlePointerUp = (): void => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [getColumnWidth],
  );

  return {
    getColumnWidth,
    handleColumnResizeStart,
    resultGridStyle,
  };
};
