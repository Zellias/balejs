import { BaleRpcError } from "../errors";
import { decodeMessage, encodeMessage } from "./proto";

export interface GrpcConnectionOptions {
  baseUrl?: string;
  origin?: string;
  appVersion?: string;
  browserType?: string;
  browserVersion?: string;
  osType?: string;
  userAgent?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
}

export interface GrpcRequestOptions {
  accessToken?: string;
}

function normalizedTimestamp(): string {
  return String(Date.now());
}

function grpcFrame(content: Uint8Array): Buffer {
  const body = Buffer.from(content);
  const frame = Buffer.allocUnsafe(body.length + 5);
  frame.writeUInt8(0, 0);
  frame.writeUInt32BE(body.length, 1);
  body.copy(frame, 5);
  return frame;
}

function cleanGrpcBody(content: Uint8Array): Buffer {
  const body = Buffer.from(content);
  if (body.length <= 5) {
    return Buffer.alloc(0);
  }

  const trailerTag = Buffer.from("grpc-status");
  const trailerIndex = body.indexOf(trailerTag);
  if (trailerIndex !== -1) {
    return body.subarray(5, trailerIndex);
  }

  const frameLength = body.readUInt32BE(1);
  const frameEnd = 5 + frameLength;
  if (frameEnd <= body.length) {
    return body.subarray(5, frameEnd);
  }

  return body.subarray(5);
}

function headerValue(value: string | string[] | number | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  if (typeof value === "number") {
    return String(value);
  }

  return value;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isRetriableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function createTimeoutSignal(timeoutMs: number): AbortSignal | undefined {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined;
  }

  const controller = new AbortController();
  setTimeout(() => {
    controller.abort();
  }, timeoutMs).unref?.();
  return controller.signal;
}

export class BaleGrpcConnection {
  readonly baseUrl: string;
  readonly origin: string;
  readonly appVersion: string;
  readonly browserType: string;
  readonly browserVersion: string;
  readonly osType: string;
  readonly userAgent: string;
  readonly sessionId: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly retryBaseDelayMs: number;
  private readonly baseHeaders: Record<string, string>;

  constructor(options: GrpcConnectionOptions = {}) {
    this.baseUrl = options.baseUrl ?? "https://next-ws.bale.ai";
    this.origin = options.origin ?? "https://web.bale.ai";
    this.appVersion = options.appVersion ?? "113466";
    this.browserType = options.browserType ?? "1";
    this.browserVersion = options.browserVersion ?? "138.0.0.0";
    this.osType = options.osType ?? "3";
    this.userAgent =
      options.userAgent ??
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";
    this.sessionId = normalizedTimestamp();
    this.timeoutMs = Math.max(1_000, Math.floor(options.timeoutMs ?? 30_000));
    this.maxRetries = Math.max(0, Math.floor(options.maxRetries ?? 1));
    this.retryBaseDelayMs = Math.max(100, Math.floor(options.retryBaseDelayMs ?? 400));
    this.baseHeaders = {
      "content-type": "application/grpc-web+proto",
      "user-agent": this.userAgent,
      "app_version": this.appVersion,
      "browser_type": this.browserType,
      "browser_version": this.browserVersion,
      "os_type": this.osType,
      "mt_app_version": this.appVersion,
      "mt_browser_type": this.browserType,
      "mt_browser_version": this.browserVersion,
      "mt_os_type": this.osType,
      "mt_session_id": this.sessionId,
      "origin": this.origin,
      "session_id": this.sessionId,
    };
  }

  close(): void {
    return;
  }

  async request<TResponse>(
    service: string,
    method: string,
    requestType: string,
    responseType: string,
    payload: object,
    options: GrpcRequestOptions = {},
  ): Promise<TResponse> {
    const body = grpcFrame(encodeMessage(requestType, payload));
    for (let attempt = 0; ; attempt += 1) {
      const headers = new Headers(this.baseHeaders);

      if (options.accessToken) {
        headers.set("cookie", `access_token=${options.accessToken}`);
      }

      try {
        const response = await fetch(`${this.baseUrl}/${service}/${method}`, {
          method: "POST",
          headers,
          body: new Uint8Array(body),
          signal: createTimeoutSignal(this.timeoutMs),
        });

        const grpcMessage = response.headers.get("grpc-message");
        const grpcStatusValue = headerValue(response.headers.get("grpc-status") ?? undefined) ?? "0";
        const grpcStatus = Number(grpcStatusValue);

        if (grpcMessage || (!Number.isNaN(grpcStatus) && grpcStatus !== 0)) {
          const error = new BaleRpcError(
            Number.isNaN(grpcStatus) ? -1 : grpcStatus,
            grpcMessage ?? `HTTP ${response.status}`,
            `${service}/${method}`,
          );
          if (attempt < this.maxRetries && isRetriableStatus(Number.isNaN(grpcStatus) ? response.status : grpcStatus)) {
            await delay(this.retryBaseDelayMs * (attempt + 1));
            continue;
          }
          throw error;
        }

        if (!response.ok) {
          const error = new BaleRpcError(response.status, `HTTP ${response.status}`, `${service}/${method}`);
          if (attempt < this.maxRetries && isRetriableStatus(response.status)) {
            await delay(this.retryBaseDelayMs * (attempt + 1));
            continue;
          }
          throw error;
        }

        const responseBody = cleanGrpcBody(new Uint8Array(await response.arrayBuffer()));
        return decodeMessage<TResponse>(responseType, responseBody);
      } catch (error) {
        if (attempt < this.maxRetries && (isAbortError(error) || !(error instanceof BaleRpcError))) {
          await delay(this.retryBaseDelayMs * (attempt + 1));
          continue;
        }
        throw error;
      }
    }
  }
}
