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

export class BaleGrpcConnection {
  readonly baseUrl: string;
  readonly origin: string;
  readonly appVersion: string;
  readonly browserType: string;
  readonly browserVersion: string;
  readonly osType: string;
  readonly userAgent: string;
  readonly sessionId: string;
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
    const headers = new Headers(this.baseHeaders);

    if (options.accessToken) {
      headers.set("cookie", `access_token=${options.accessToken}`);
    }

    const response = await fetch(`${this.baseUrl}/${service}/${method}`, {
      method: "POST",
      headers,
      body: new Uint8Array(body),
    });

    const grpcMessage = response.headers.get("grpc-message");
    const grpcStatusValue = headerValue(response.headers.get("grpc-status") ?? undefined) ?? "0";
    const grpcStatus = Number(grpcStatusValue);

    if (grpcMessage || (!Number.isNaN(grpcStatus) && grpcStatus !== 0)) {
      throw new BaleRpcError(
        Number.isNaN(grpcStatus) ? -1 : grpcStatus,
        grpcMessage ?? `HTTP ${response.status}`,
        `${service}/${method}`,
      );
    }

    if (!response.ok) {
      throw new BaleRpcError(response.status, `HTTP ${response.status}`, `${service}/${method}`);
    }

    const responseBody = cleanGrpcBody(new Uint8Array(await response.arrayBuffer()));
    return decodeMessage<TResponse>(responseType, responseBody);
  }
}
