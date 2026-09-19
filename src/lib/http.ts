/** JSON response that polling clients and shared caches must never reuse. */
export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function errorJson(status: number, error: string, extra?: Record<string, unknown>): Response {
  return json({ error, ...extra }, status);
}
