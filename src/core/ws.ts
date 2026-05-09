import { EventEmitter } from "node:events";

import WebSocket, { type RawData } from "ws";

import { BaleRpcError, ClientStateError } from "../errors";
import { decodeMessage, encodeMessage } from "./proto";

export interface WebSocketConnectionOptions {
  websocketUri?: string;
  origin?: string;
  timeoutSeconds?: number;
  appVersion?: number;
  browserType?: string;
  browserVersion?: number;
  osType?: string;
}

interface PendingResponse {
  responseType?: string;
  reject: (error: Error) => void;
  resolve: (value: any) => void;
  timer: NodeJS.Timeout;
}

function normalizedTimestamp(): string {
  return String(Date.now());
}

function rawDataToBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data);
  }

  return Buffer.from(data as ArrayBuffer);
}

export class BaleWebSocketConnection extends EventEmitter {
  readonly accessToken: string;
  readonly websocketUri: string;
  readonly origin: string;
  readonly timeoutSeconds: number;
  readonly appVersion: number;
  readonly browserType: string;
  readonly browserVersion: number;
  readonly osType: string;

  private socket?: WebSocket;
  private sessionId?: string;
  private nextIndex = 1;
  private readonly pendingResponses = new Map<number, PendingResponse>();
  private keepAliveTimer?: NodeJS.Timeout;
  private requestMetadata?: object;
  private encodedKeepAlive?: Buffer;
  private static nextRid = Date.now() * 1000;

  constructor(accessToken: string, options: WebSocketConnectionOptions = {}) {
    super();
    this.accessToken = accessToken;
    this.websocketUri = options.websocketUri ?? "wss://next-ws.bale.ai/ws/";
    this.origin = options.origin ?? "https://web.bale.ai";
    this.timeoutSeconds = options.timeoutSeconds ?? 20;
    this.appVersion = options.appVersion ?? 86550;
    this.browserType = options.browserType ?? "1";
    this.browserVersion = options.browserVersion ?? 3471765337684194354;
    this.osType = options.osType ?? "3";
  }

  static createRid(): number {
    return ++this.nextRid;
  }

  async start(): Promise<void> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    this.sessionId = normalizedTimestamp();
    this.requestMetadata = this.buildRequestMetadata();
    this.encodedKeepAlive = Buffer.from(encodeMessage("request.KeepAliveRequest", {
      payloads: {
        value_should_2: 2,
      },
    }));
    this.socket = new WebSocket(this.websocketUri, {
      origin: this.origin,
      perMessageDeflate: false,
      skipUTF8Validation: true,
      headers: {
        Cookie: `access_token=${this.accessToken}`,
      },
    });

    await new Promise<void>((resolve, reject) => {
      const socket = this.socket;
      if (!socket) {
        reject(new ClientStateError("WebSocket was not created"));
        return;
      }

      const onOpen = () => {
        cleanup();
        resolve();
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        socket.off("open", onOpen);
        socket.off("error", onError);
      };

      socket.once("open", onOpen);
      socket.once("error", onError);
      socket.on("message", (data) => {
        void this.handleIncoming(data);
      });
      socket.on("close", () => {
        this.failPending(new ClientStateError("Bale websocket closed"));
        this.emit("close");
      });
      socket.on("error", (error) => {
        this.failPending(error instanceof Error ? error : new Error(String(error)));
        this.emit("error", error);
      });
    });

    await this.keepAlive();
    this.keepAliveTimer = setInterval(() => {
      void this.keepAlive().catch(() => {
        return;
      });
    }, 15000);
  }

  async stop(): Promise<void> {
    if (!this.socket) {
      return;
    }

    const socket = this.socket;
    this.socket = undefined;
    this.failPending(new ClientStateError("Bale websocket stopped"));
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = undefined;
    }

    await new Promise<void>((resolve) => {
      socket.once("close", () => resolve());
      socket.close();
    });
  }

  async keepAlive(): Promise<void> {
    if (!this.encodedKeepAlive) {
      throw new ClientStateError("Bale websocket keepalive payload is not initialized");
    }

    await this.sendEncoded(this.encodedKeepAlive);
  }

  async sendRaw(typeName: string, payload: object): Promise<void> {
    await this.sendEncoded(Buffer.from(encodeMessage(typeName, payload)));
  }

  async sendEncoded(content: Buffer): Promise<void> {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new ClientStateError("Bale websocket is not connected");
    }

    await new Promise<void>((resolve, reject) => {
      socket.send(content, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  async request<TResponse>(
    serviceName: string,
    method: string,
    requestType: string,
    payload: object,
    responseType?: string,
  ): Promise<TResponse> {
    const requestIndex = this.nextIndex++;
    const responsePromise = new Promise<TResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingResponses.delete(requestIndex);
        reject(new ClientStateError(`Timed out waiting for Bale response ${requestIndex}`));
      }, this.timeoutSeconds * 1000);

      this.pendingResponses.set(requestIndex, {
        responseType,
        resolve,
        reject,
        timer,
      });
    });

    try {
      await this.sendEncoded(Buffer.from(encodeMessage("request.Request", {
        ws_request: {
          service_name: serviceName,
          method,
          payload: encodeMessage(requestType, payload),
          metadata: this.requestMetadata,
          index: requestIndex,
        },
      })));
    } catch (error) {
      const pending = this.pendingResponses.get(requestIndex);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingResponses.delete(requestIndex);
      }

      throw error;
    }

    return await responsePromise;
  }

  private buildRequestMetadata(): object {
    return {
      key_values: [
        {
          key: "app_version",
          value: {
            string_value: String(this.appVersion),
          },
        },
        {
          key: "browser_type",
          value: {
            string_value: this.browserType,
          },
        },
        {
          key: "browser_version",
          value: {
            msg_value: {
              fixed64_value: this.browserVersion,
            },
          },
        },
        {
          key: "os_type",
          value: {
            string_value: this.osType,
          },
        },
        {
          key: "session_id",
          value: {
            string_value: this.sessionId,
          },
        },
      ],
    };
  }

  private async handleIncoming(data: RawData): Promise<void> {
    const payload = rawDataToBuffer(data);

    let response: Record<string, unknown>;
    try {
      response = decodeMessage<Record<string, unknown>>("response.Response", payload);
    } catch (decodeError) {
      this.emit("warning", decodeError);
      return;
    }

    if (response.ws_update) {
      this.emit("update", response.ws_update);
      return;
    }

    const wsResponse = response.ws_response as Record<string, unknown> | undefined;
    if (!wsResponse) {
      return;
    }

    const index = Number(wsResponse.index);
    const pending = this.pendingResponses.get(index);
    if (!pending) {
      return;
    }

    this.pendingResponses.delete(index);
    clearTimeout(pending.timer);

    if (wsResponse.error) {
      const error = wsResponse.error as Record<string, unknown>;
      pending.reject(
        new BaleRpcError(
          Number(error.code),
          String(error.message ?? "Unknown Bale websocket error"),
          methodNameFromResponse(wsResponse),
        ),
      );
      return;
    }

    try {
      if (pending.responseType) {
        pending.resolve(decodeMessage(pending.responseType, wsResponse.response as Uint8Array));
        return;
      }

      pending.resolve(wsResponse.response as Uint8Array);
    } catch (error) {
      pending.reject(error as Error);
    }
  }

  private failPending(error: Error): void {
    for (const [index, pending] of this.pendingResponses) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pendingResponses.delete(index);
    }
  }
}

function methodNameFromResponse(response: Record<string, unknown>): string | undefined {
  return typeof response.method === "string" ? response.method : undefined;
}
