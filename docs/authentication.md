# Authentication

[Docs Home](./README.md) | [Getting Started](./getting-started.md) | [Handlers and Conditions](./handlers-and-conditions.md)

## Supported Auth Modes

The client supports two auth inputs:

1. phone number
2. existing session string

The constructor accepts either:

```js
const client = new Client(process.env.BALE_SESSION || process.env.BALE_PHONE);
```

## Phone Number Login

When you pass a phone number, the client starts Bale phone auth:

```bash
BALE_PHONE='+989121234567' node examples/echo.js
```

The client will:

1. call `StartPhoneAuth`
2. prompt for the code
3. optionally prompt for password if Bale requires it
4. save the resulting session

These auth calls use the library's gRPC-web POST transport rather than the websocket update channel.

## Session String Login

A session string uses this shape:

```text
<userId>:<jwt>
```

Example:

```bash
BALE_SESSION='123456:eyJhbGciOi...' node examples/echo.js
```

This skips the interactive code flow.

## Session Persistence

When auth succeeds, the session is written to a file named after the original auth input:

```text
<sessionDir>/<token-or-phone>.session
```

If the file exists, `Client.connect()` tries to reuse it automatically.

## Relevant Client Methods

- `start_phone_auth(phoneNumber)`
- `validate_code(transactionHash, code)`
- `validate_password(transactionHash, password)`
- `sign_up(transactionHash, name, password?)`
- `sign_out()`
- `connect()`
- `disconnect()`

These are public, but most applications should call `connect()` or `run()` and let the client manage the flow.

## Common Auth Errors

### `AuthenticationError`

Raised when the login flow fails at the client layer.

### `BaleRpcError`

Raised when Bale returns an RPC error such as:

- `PHONE_NUMBER_INVALID`
- `PHONE_CODE_INVALID`

### `ClientStateError`

Raised when the client is used in an invalid state, such as trying to use websocket methods before connecting.

## Real-World Notes

- Use a real Bale account phone number.
- International format like `+989...` is recommended for input clarity.
- The client normalizes phone input before sending it to Bale.
- For automation, reusing a saved session is usually better than repeating phone auth.
- `sign_out()` clears the in-memory session state and is intended for explicit logout flows.
