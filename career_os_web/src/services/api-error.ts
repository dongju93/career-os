export const DATABASE_UNAVAILABLE_CODE = 'DATABASE_UNAVAILABLE';
export const INTERNAL_SERVER_ERROR_CODE = 'INTERNAL_SERVER_ERROR';
export const UNKNOWN_API_ERROR_CODE = 'UNKNOWN_API_ERROR';
export const RATE_LIMIT_EXCEEDED_CODE = 'RATE_LIMIT_EXCEEDED';
export const QUOTA_EXCEEDED_CODE = 'QUOTA_EXCEEDED';
export const CLIENT_CONTRACT_MISMATCH = 'CLIENT_CONTRACT_MISMATCH';

export type ApiErrorCode =
  | typeof DATABASE_UNAVAILABLE_CODE
  | typeof INTERNAL_SERVER_ERROR_CODE
  | typeof UNKNOWN_API_ERROR_CODE
  | typeof RATE_LIMIT_EXCEEDED_CODE
  | typeof QUOTA_EXCEEDED_CODE
  | typeof CLIENT_CONTRACT_MISMATCH
  | string;

export interface UserFacingError {
  code: ApiErrorCode;
  message: string;
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor({
    code,
    message,
    status,
  }: {
    code: ApiErrorCode;
    message: string;
    status: number;
  }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasAnyHeader(headers: Headers | undefined, names: string[]): boolean {
  return names.some((name) => headers?.has(name));
}

function getErrorCode(response: Response, body: unknown): ApiErrorCode {
  if (isRecord(body) && typeof body.code === 'string') {
    return body.code;
  }

  if (
    isRecord(body) &&
    isRecord(body.detail) &&
    typeof body.detail.code === 'string'
  ) {
    return body.detail.code;
  }

  if (response.status === 429) {
    if (
      hasAnyHeader(response.headers, [
        'X-Quota-Limit',
        'X-Quota-Remaining',
        'X-Quota-Reset',
      ])
    ) {
      return QUOTA_EXCEEDED_CODE;
    }

    return RATE_LIMIT_EXCEEDED_CODE;
  }

  const { status } = response;
  return status >= 500 ? INTERNAL_SERVER_ERROR_CODE : UNKNOWN_API_ERROR_CODE;
}

function getErrorMessage(body: unknown, fallbackMessage: string): string {
  if (isRecord(body) && typeof body.message === 'string') {
    return body.message;
  }

  if (isRecord(body) && typeof body.detail === 'string') {
    return body.detail;
  }

  if (
    isRecord(body) &&
    isRecord(body.detail) &&
    typeof body.detail.message === 'string'
  ) {
    return body.detail.message;
  }

  return fallbackMessage;
}

export async function parseApiError(
  response: Response,
  fallbackMessage: string,
): Promise<ApiError> {
  let body: unknown = null;

  try {
    body = await response.json();
  } catch {
    // use fallback message and derived code
  }

  return new ApiError({
    code: getErrorCode(response, body),
    message: getErrorMessage(body, fallbackMessage),
    status: response.status,
  });
}

export function toUserFacingError(
  error: unknown,
  fallbackMessage: string,
): UserFacingError {
  if (error instanceof ApiError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      code: UNKNOWN_API_ERROR_CODE,
      message: error.message,
    };
  }

  return {
    code: UNKNOWN_API_ERROR_CODE,
    message: fallbackMessage,
  };
}
