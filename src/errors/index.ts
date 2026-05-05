export class BaleRpcError extends Error {
  readonly code: number;
  readonly reason?: string;

  constructor(code: number, message: string, reason?: string) {
    super(message || `Bale RPC error ${code}`);
    this.name = "BaleRpcError";
    this.code = code;
    this.reason = reason;
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class ClientStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientStateError";
  }
}
