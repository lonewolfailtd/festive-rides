// Tiny shared helper for the `err instanceof Error ? err.message : "..."`
// pattern repeated across the uni tools' catch blocks.
export const getErrorMessage = (err: unknown, fallback = "Something went wrong") =>
  err instanceof Error ? err.message : fallback;
