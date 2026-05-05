import http2 from "node:http2";

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

function stripGrpcFrame(content: Buffer): Buffer {
  return content.subarray(5, 5 + content.readUInt32BE(1));
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
  private readonly baseHeaders: http2.OutgoingHttpHeaders;
  private client?: http2.ClientHttp2Session;

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
    if (!this.client || this.client.closed || this.client.destroyed) {
      this.client = undefined;
      return;
    }

    this.client.close();
    this.client = undefined;
  }

  async request<TResponse>(
    service: string,
    requestType: string,
    responseType: string,
    payload: object,
  ): Promise<TResponse> {
    const client = this.getClient();
    const body = grpcFrame(encodeMessage(requestType, payload));

    try {
      const { headers, trailers, responseBody } = await new Promise<{
        headers: http2.IncomingHttpHeaders;
        trailers: http2.IncomingHttpHeaders;
        responseBody: Buffer;
      }>((resolve, reject) => {
        const chunks: Buffer[] = [];
        let responseHeaders: http2.IncomingHttpHeaders = {};
        let responseTrailers: http2.IncomingHttpHeaders = {};

        const stream = client.request({
          ":method": "POST",
          ":path": `/${service}`,
          ...this.baseHeaders,
        });

        stream.on("response", (incomingHeaders) => {
          responseHeaders = incomingHeaders;
        });

        stream.on("trailers", (incomingTrailers) => {
          responseTrailers = incomingTrailers;
        });

        stream.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        stream.on("end", () => {
          resolve({
            headers: responseHeaders,
            trailers: responseTrailers,
            responseBody: Buffer.concat(chunks),
          });
        });

        stream.on("error", reject);
        stream.end(body);
      });

      const statusValue = headerValue(trailers["grpc-status"]) ?? headerValue(headers["grpc-status"]) ?? "0";
      const status = Number(statusValue);

      if (!Number.isNaN(status) && status !== 0) {
        const message = headerValue(trailers["grpc-message"]) ?? headerValue(headers["grpc-message"]) ?? "Unknown gRPC error";
        throw new BaleRpcError(status, message, service);
      }

      return decodeMessage<TResponse>(responseType, stripGrpcFrame(responseBody));
    } catch (error) {
      if (this.client && (this.client.closed || this.client.destroyed)) {
        this.client = undefined;
      }

      throw error;
    }
  }

  private getClient(): http2.ClientHttp2Session {
    if (!this.client || this.client.closed || this.client.destroyed) {
      this.client = http2.connect(this.baseUrl);
      this.client.on("connect", () => {
        this.client?.socket?.setNoDelay(true);
      });
      this.client.on("error", () => {
        this.client = undefined;
      });
      this.client.on("close", () => {
        this.client = undefined;
      });
    }

    return this.client;
  }
}
