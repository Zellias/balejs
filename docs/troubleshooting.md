# Troubleshooting

[Docs Home](./README.md) | [Authentication](./authentication.md)

## `PHONE_NUMBER_INVALID`

This comes from Bale auth, not from the dispatcher or message system.

Check:

- you are using the real Bale account phone number
- you are passing either `BALE_PHONE` or `BALE_SESSION`
- your example file is not overriding the env var with a hardcoded string

Recommended run command:

```bash
BALE_PHONE='+989121234567' node examples/echo.js
```

## Session Issues

If a saved `.session` file is stale or wrong, remove it and log in again:

```text
<sessionDir>/<token-or-phone>.session
```

Then rerun the client.

## `ClientStateError: Bale userbot is not connected`

You called a websocket RPC before `connect()` or `run()` finished.

Use:

```js
await client.connect();
await client.send_message("12345|1", "hello");
```

or register work inside `run()` lifecycle or handlers.

## Handler Errors

If your handler throws and you do not have an `on_error` handler, the error will bubble.

Add:

```js
client.on_error(async function logError(error) {
  console.error(error);
});
```

## Empty or Missing Chats

`get_chat()` can return `undefined`.

That usually means:

- the peer id is wrong
- the search query did not resolve
- Bale did not return the peer in the current session context

## Performance Notes

Current speed work already in the library:

- cached protobuf type lookup
- persistent HTTP/2 auth connection
- websocket metadata reuse
- pre-encoded keepalive payload
- cached lightweight chat and author wrappers for updates

## Building

If you change TypeScript or proto files:

```bash
npm run check
npm run build
```
