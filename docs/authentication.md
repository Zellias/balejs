# Authentication

[Docs Home](./README.md) | [Getting Started](./getting-started.md) | [Troubleshooting](./troubleshooting.md)

## Supported Inputs

The `Client` constructor accepts:

- a Bale phone number
- a Bale session string

Example:

```js
const client = new Client(process.env.BALE_SESSION || process.env.BALE_PHONE);
```

## Phone Login

If you pass a phone number, the client performs Bale phone authentication.

Typical run command:

```bash
BALE_PHONE='+989121234567' node examples/echo.js
```

Flow:

1. `connect()` or `run()` calls `start_phone_auth()`
2. the terminal prompts for the login code
3. if Bale requires a password, the terminal prompts for it
4. if the account is not registered, the terminal prompts for a display name and uses `sign_up()`
5. the resulting session is saved to disk

## Session String Login

A session string has this shape:

```text
<userId>:<jwt>
```

Example:

```bash
BALE_SESSION='123456:eyJhbGciOi...' node examples/echo.js
```

This skips the interactive code flow.

## Session Files

Successful authentication writes a session file here:

```text
<sessionDir>/<token-or-phone>.session
```

By default `sessionDir` is the current working directory.

If you want a stable custom filename, pass `sessionName` in the client options:

```js
const client = new Client(process.env.BALE_PHONE, {
  sessionDir: "./sessions",
  sessionName: "main-account",
});
```

That writes the session to:

```text
./sessions/main-account.session
```

## Public Auth Methods

- `start_phone_auth(phoneNumber)`
- `validate_code(transactionHash, code)`
- `validate_password(transactionHash, password)`
- `sign_up(transactionHash, name, password?)`
- `sign_out()`

Most apps should not call the low-level auth methods directly. Use `connect()` or `run()` unless you are building a custom login flow.

## Logout

`sign_out()`:

- calls Bale sign-out
- clears in-memory session state
- clears caches
- removes the session file if it exists

## Transport Notes

Auth methods use the gRPC-web POST transport, not the websocket transport.

That matters because:

- auth works before the websocket connects
- `post()` can still be useful even if the live connection is not running

## Errors You May See

- `AuthenticationError`
- `BaleRpcError`
- `ClientStateError`

Common Bale RPC messages:

- `PHONE_NUMBER_INVALID`
- `PHONE_CODE_INVALID`
- password-related Bale RPC failures

## Recommended Practice

- use a real Bale account
- keep phone numbers in international format
- prefer stored sessions for repeated local development
- delete stale `.session` files when Bale rejects an old token
