import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import type { UpdateStatusPayload } from "@/vite-env";

const check = vi.fn();
const download = vi.fn();
const install = vi.fn();
const unsubscribe = vi.fn();
let statusListener: ((payload: UpdateStatusPayload) => void) | null = null;
const onStatus = vi.fn((listener: (payload: UpdateStatusPayload) => void) => {
  statusListener = listener;
  return unsubscribe;
});

describe("useAppUpdate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    check.mockReset().mockResolvedValue(undefined);
    download.mockReset().mockResolvedValue(undefined);
    install.mockReset().mockResolvedValue(undefined);
    unsubscribe.mockReset();
    onStatus.mockClear();
    statusListener = null;
    Object.defineProperty(window, "pgdesk", {
      configurable: true,
      value: { update: { check, download, install, onStatus } },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears the install fallback timer when a new status arrives", async () => {
    const { result } = renderHook(() => useAppUpdate());

    await act(async () => {
      await result.current.handleInstallUpdate();
    });

    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      statusListener?.({
        status: "downloaded",
        message: "Ready to install",
        version: "0.1.42",
      });
    });

    expect(vi.getTimerCount()).toBe(0);
    expect(result.current.updateStatus?.status).toBe("downloaded");
  });

  it("clears the install fallback timer when the hook unmounts", async () => {
    const { result, unmount } = renderHook(() => useAppUpdate());

    await act(async () => {
      await result.current.handleInstallUpdate();
    });

    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
