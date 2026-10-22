export async function request<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail =
      typeof error.detail === "string"
        ? error.detail
        : "The request could not be completed. Check your filters and try again.";
    throw new Error(
      response.status === 502 || response.status === 500
        ? "The data service is unavailable. Start the CourtVision server and retry."
        : detail,
    );
  }
  return response.json();
}

export const number = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined
    ? "—"
    : value.toLocaleString("en-US", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      });
export const signed = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "—"
    : `${value > 0 ? "+" : ""}${number(value)}`;
export const shortDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
export const elapsedLabel = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
