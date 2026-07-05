import type { z } from 'zod/v4';
import { ApiError, CLIENT_CONTRACT_MISMATCH } from './api-error';

// Shared contract-mismatch message. Previously copy-pasted as a per-file
// `CONTRACT_ERROR_MESSAGE` constant in every service; centralized here so all
// service functions surface the identical user-facing string.
const CONTRACT_ERROR_MESSAGE = '서버 응답 형식이 올바르지 않습니다.';

/**
 * Reads a JSON response body, validates it against an `ApiResponse` envelope
 * schema, and returns the unwrapped `data` payload.
 *
 * Replaces the `const raw = await response.json(); assertContractMatch(SCHEMA
 * .safeParse(raw)).data;` ritual that was duplicated across every service. On a
 * Zod mismatch it throws the same `ApiError` (`CLIENT_CONTRACT_MISMATCH`,
 * `status: 0`) the inlined helpers threw, so failure behavior is unchanged.
 *
 * The generic is constrained to `{ data: unknown }` so `schema` must be an
 * envelope schema (`apiResponseSchema(...)`); the return type is inferred as the
 * envelope's inner `data` type. ChatKit deliberately bypasses this path — its
 * responses are streamed and are not `ApiResponse`-shaped.
 */
export async function parseApiResponse<
  Schema extends z.ZodType<{ data: unknown }>,
>(schema: Schema, response: Response): Promise<z.infer<Schema>['data']> {
  const raw: unknown = await response.json();
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ApiError({
      code: CLIENT_CONTRACT_MISMATCH,
      message: CONTRACT_ERROR_MESSAGE,
      status: 0,
    });
  }
  return result.data.data;
}
