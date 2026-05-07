# Troubleshooting

[Docs Home](./README.md) | [Authentication](./authentication.md) | [Client API](./client-api.md)

## `PHONE_NUMBER_INVALID`

This is a Bale auth response.

Check:

- you are using the real Bale account phone number
- the number belongs to a Bale account
- you passed `BALE_PHONE` or `BALE_SESSION`
- the phone number is in a sane format such as `+989121234567`

Recommended command:

```bash
BALE_PHONE='+989121234567' node examples/echo.js
```

## Stale Session Files

If Bale rejects a saved session, remove the `.session` file and authenticate again.

Session file location:

```text
<sessionDir>/<token-or-phone>.session
```

## `ClientStateError`

Common causes:

- sending websocket RPCs before `connect()` finishes
- calling live methods after disconnect
- trying to use message helpers on unbound manual objects

Correct pattern:

```js
await client.connect();
await client.send_message("12345|1", "hello");
await client.disconnect();
```

Or:

```js
client.run();
```

## `BaleRpcError`

This means Bale returned an RPC failure.

Useful fields:

- `error.code`
- `error.message`
- `error.reason`

Example:

```js
client.on_error(async function logError(error) {
  console.error(error);
});
```

## `get_chat()` Returns `undefined`

That usually means:

- the peer id is wrong
- the search query did not resolve
- Bale did not return the peer for the current account/session

Remember that peer ids must look like:

```text
<id>|<type>
```

## Message Id Problems

Methods such as `edit_message_text()`, `delete_message()`, `forward_message()`, and `copy_message()` expect message ids in this form:

```text
<rid>|<date>
```

If you already have a wrapped `Message`, use `message.id`.

## Gift Problems

If gift sending or opening fails:

- verify that the account has wallet access
- verify that a wallet token exists
- call `get_wallet()` and inspect `wallet.wallet?.token`

## File Upload Confusion

`get_file_upload_url()` does not upload the file for you. It only returns Bale upload metadata.

## Build After Source Changes

If you change TypeScript or proto files:

```bash
npm run check
npm run build
```

## Debugging Strategy

For most local issues:

1. add an `on_error()` handler
2. verify auth input
3. delete stale `.session` files if needed
4. rebuild after changing source
5. inspect the raw output from low-level methods if a wrapper returns `Record<string, any>`
