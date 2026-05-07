# balejs Docs

This is the documentation set for `balejs`, the Bale user library created by [Zellias](https://github.com/zellias).

It documents the library as its own project and explains the API directly in `balejs` terms.

## Pages

- [Getting Started](./getting-started.md)
- [Authentication](./authentication.md)
- [Handlers and Conditions](./handlers-and-conditions.md)
- [Client API](./client-api.md)
- [Objects and Enums](./objects-and-enums.md)
- [Gifts and Reports](./gifts-and-reports.md)
- [Troubleshooting](./troubleshooting.md)

## What `balejs` Is

`balejs` is a CommonJS-first Node.js library for working with real Bale user sessions.

Core pieces:

- `Client`
- message handlers
- condition helpers
- wrapped `User`, `Chat`, and `Message` objects
- transport helpers for websocket RPC and gRPC-web POST

## What It Covers

- interactive login and saved sessions
- live websocket updates
- direct Bale RPC access
- chats, groups, history, pins, avatars, files, reactions, gifts, wallet, and reports

## Reading Order

1. [Getting Started](./getting-started.md)
2. [Authentication](./authentication.md)
3. [Handlers and Conditions](./handlers-and-conditions.md)
4. [Client API](./client-api.md)
5. [Objects and Enums](./objects-and-enums.md)
6. [Gifts and Reports](./gifts-and-reports.md)
7. [Troubleshooting](./troubleshooting.md)

## Minimal Example

```js
const { Client, all, private: privateChat, text } = require("../dist");

const auth = process.env.BALE_SESSION || process.env.BALE_PHONE;

if (!auth) {
  throw new Error("Set BALE_PHONE or BALE_SESSION before starting the client.");
}

const client = new Client(auth);

client.on_message(all(privateChat, text))(async function echo(message) {
  await message.reply(message.text);
});

client.run();
```
