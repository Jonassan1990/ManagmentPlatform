/**
 * Polite status announcer for async filter/sort/result updates.
 * Keep messages short; avoid duplicate assertive alerts.
 */
export function LiveRegion({
  message,
  id,
  atomic = true,
}: {
  message: string;
  id?: string;
  atomic?: boolean;
}) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="status"
      aria-live="polite"
      aria-atomic={atomic}
      className="sr-only"
      data-testid="live-region"
    >
      {message}
    </p>
  );
}
