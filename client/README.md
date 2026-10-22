# CourtVision Lakers interface

See the [root README](../README.md) for installation, data imports, verification, and launch instructions.

Next.js proxies `/api/*` to the Python API at `CV_API_ORIGIN` (default `http://127.0.0.1:8000`). UI state and server calculations share the filter types in `src/lib/types.ts`; the server validates every request. Charts display imported source events and calculated results, with no synthetic fallback.
