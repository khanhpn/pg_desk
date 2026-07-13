import { useCallback, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const SIDEBAR_MIN_WIDTH = 240;
const SIDEBAR_MAX_WIDTH = 460;
const SIDEBAR_DEFAULT_WIDTH = 280;
const RESULT_PANEL_MIN_HEIGHT = 300;
const RESULT_PANEL_TOP_RESERVE = 132;

const getDefaultResultPanelHeight = (): number => {
  return Math.max(
    RESULT_PANEL_MIN_HEIGHT,
    Math.round(window.innerHeight * 0.46),
  );
};

/**
 * Owns pointer-driven dimensions for the sidebar and result panel.
 *
 * @returns Clamped panel dimensions, shell state, and pointer-down handlers that
 * begin each resize interaction.
 * @remarks Registers document-level pointer listeners only while a resize is in
 * progress and removes them when resizing ends or the hook unmounts.
 */
export const useResizablePanels = () => {
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [resultPanelHeight, setResultPanelHeight] = useState(
    getDefaultResultPanelHeight,
  );
  const [resizeMode, setResizeMode] = useState<"sidebar" | "result" | null>(
    null,
  );

  const appShellClassName = resizeMode
    ? `app-shell is-resizing-${resizeMode}`
    : "app-shell";

  const handleSidebarResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      setResizeMode("sidebar");

      const startX = event.clientX;
      const startWidth = sidebarWidth;

      const handlePointerMove = (moveEvent: PointerEvent): void => {
        setSidebarWidth(
          clamp(
            startWidth + moveEvent.clientX - startX,
            SIDEBAR_MIN_WIDTH,
            SIDEBAR_MAX_WIDTH,
          ),
        );
      };

      const handlePointerUp = (): void => {
        setResizeMode(null);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [sidebarWidth],
  );

  const handleResultPanelResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      setResizeMode("result");

      const startY = event.clientY;
      const startHeight = resultPanelHeight;

      const handlePointerMove = (moveEvent: PointerEvent): void => {
        const maxResultPanelHeight = Math.max(
          RESULT_PANEL_MIN_HEIGHT,
          window.innerHeight - RESULT_PANEL_TOP_RESERVE,
        );

        setResultPanelHeight(
          clamp(
            startHeight + startY - moveEvent.clientY,
            RESULT_PANEL_MIN_HEIGHT,
            maxResultPanelHeight,
          ),
        );
      };

      const handlePointerUp = (): void => {
        setResizeMode(null);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [resultPanelHeight],
  );

  return {
    appShellClassName,
    sidebarWidth,
    resultPanelHeight,
    handleSidebarResizeStart,
    handleResultPanelResizeStart,
  };
};
