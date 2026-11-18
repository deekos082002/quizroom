/**
 * Call a server action from the browser. Actions answer with an
 * `{ success, data } | { success: false, code, error }` envelope; this throws
 * an ActionError for any failure so callers can branch on `code`.
 * (The SDK's `callAction` exists only in the React Native build.)
 */

import { getAuthToken } from 'deepspace'

export class ActionError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'ActionError'
  }
}

export async function callAction<T = unknown>(name: string, params: Record<string, unknown>): Promise<T> {
  const token = await getAuthToken()
  const res = await fetch(`/api/actions/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  })
  let body: { success?: boolean; data?: T; code?: string; error?: string } = {}
  try {
    body = (await res.json()) as typeof body
  } catch {
    // Non-JSON error page: fall through to the status message.
  }
  if (!res.ok || !body.success) {
    throw new ActionError(body.error ?? `Request failed (${res.status})`, body.code)
  }
  return body.data as T
}
