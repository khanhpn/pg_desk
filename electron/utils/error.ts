/**
 * Converts an unknown caught value into a stable, user-presentable message.
 *
 * @param error - Value caught from an exception boundary.
 * @returns The native message for `Error` instances or a string conversion for
 * all other values.
 */
export const getErrorMessage = (error: unknown): string => {
  console.error("Electron main error:", error);

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const pgError = error as {
      message?: unknown;
      code?: unknown;
      detail?: unknown;
      hint?: unknown;
    };

    const parts = [
      pgError.message ? `message=${String(pgError.message)}` : "",
      pgError.code ? `code=${String(pgError.code)}` : "",
      pgError.detail ? `detail=${String(pgError.detail)}` : "",
      pgError.hint ? `hint=${String(pgError.hint)}` : "",
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" | ");
    }

    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown object error";
    }
  }

  return String(error || "Unknown error");
};
