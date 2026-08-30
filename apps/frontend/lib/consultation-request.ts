/**
 * Fetch helper for consultation-only endpoints that are not exposed through
 * the shared typed API client.  The caller's AbortSignal remains authoritative
 * for navigation/unmount cancellation, while the bounded timeout prevents a
 * stalled request from leaving a patient/doctor control busy forever.
 */
export const DEFAULT_CONSULTATION_REQUEST_TIMEOUT_MS = 12_000;

export class ConsultationRequestTimeoutError extends Error {
  constructor() {
    super("CONSULTATION_REQUEST_TIMEOUT");
    this.name = "ConsultationRequestTimeoutError";
  }
}

export interface ConsultationRequestOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface ConsultationResponseBody {
  response: Response;
  text: string;
}

async function fetchWithTimeout(
  target: string,
  init: RequestInit,
  options: ConsultationRequestOptions,
  readBody: boolean,
  apiPath: boolean,
): Promise<Response | ConsultationResponseBody> {
  const requestController = new AbortController();
  const callerSignal = init.signal;
  let timedOut = false;
  const abortFromCaller = () => requestController.abort(callerSignal?.reason);
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

  const timeoutMs = options.timeoutMs ?? DEFAULT_CONSULTATION_REQUEST_TIMEOUT_MS;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, timeoutMs);

  try {
    const response = await (options.fetchImpl ?? fetch)(apiPath ? `/api/v1${target}` : target, {
      ...init,
      credentials: init.credentials ?? (apiPath ? "same-origin" : "omit"),
      cache: "no-store",
      signal: requestController.signal,
    });
    if (!readBody) return response;
    const text = response.status === 204 ? "" : await response.text();
    return { response, text };
  } catch (error) {
    if (timedOut) throw new ConsultationRequestTimeoutError();
    throw error;
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function fetchConsultationResponse(
  path: string,
  init: RequestInit = {},
  options: ConsultationRequestOptions = {},
): Promise<Response> {
  return await fetchWithTimeout(path, init, options, false, true) as Response;
}

/** Fetch and consume a consultation response while the timeout remains active.
 * This is the safe path for JSON/error bodies: a server that sends headers and
 * then stalls is still bounded and preserves caller cancellation semantics.
 */
export async function fetchConsultationResponseBody(
  path: string,
  init: RequestInit = {},
  options: ConsultationRequestOptions = {},
): Promise<ConsultationResponseBody> {
  return await fetchWithTimeout(path, init, options, true, true) as ConsultationResponseBody;
}

/** Bounded direct PUT for a server-issued private object-storage URL. */
export async function fetchConsultationUploadResponse(
  url: string,
  init: RequestInit = {},
  options: ConsultationRequestOptions = {},
): Promise<Response> {
  return await fetchWithTimeout(url, init, options, false, false) as Response;
}
