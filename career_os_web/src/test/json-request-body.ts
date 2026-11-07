/**
 * Parses the JSON body a fetch mock received. `RequestInit.body` may be a
 * stream, FormData, etc., so narrow it rather than stringifying: a non-string
 * body means the code under test stopped sending JSON and should fail clearly.
 */
export function parseJsonRequestBody<T = Record<string, unknown>>(
  init: RequestInit | undefined,
): T {
  if (typeof init?.body !== 'string') {
    throw new Error('Expected the request to have a JSON string body.');
  }
  return JSON.parse(init.body) as T;
}
