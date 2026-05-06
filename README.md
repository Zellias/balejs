# balejs

TypeScript Bale userbot library for Node.js with a Balethon-style API.

It focuses on real Bale user sessions rather than the bot API and now ships with:

- interactive phone or saved-session authentication
- websocket updates for handlers and live messaging
- gRPC-web POST fallback for auth and selected RPC calls
- text messaging, history, dialogs, groups, gifts, wallet, and reports

## Docs

Full multi-page documentation lives in [docs/README.md](./docs/README.md).

- [Getting Started](./docs/getting-started.md)
- [Authentication](./docs/authentication.md)
- [Handlers and Conditions](./docs/handlers-and-conditions.md)
- [Client API](./docs/client-api.md)
- [Objects and Enums](./docs/objects-and-enums.md)
- [Gifts and Reports](./docs/gifts-and-reports.md)
- [Troubleshooting](./docs/troubleshooting.md)

## Quick Start

```bash
npm install
npm run build
```

```js
const { Client, all, private: privateChat, text } = require("./dist");

const auth = process.env.BALE_SESSION || process.env.BALE_PHONE;

if (!auth) {
  throw new Error(
    "Set BALE_PHONE to a real phone number like +989121234567, or set BALE_SESSION to an existing <userId>:<jwt> session string.",
  );
}

const client = new Client(auth);

client.on_message(all(privateChat, text))(async function echo(message) {
  await message.reply(message.text);
});

client.on_error(async function logError(error) {
  console.error(error);
});

client.run();
```

Use a real phone number like `+989121234567` or an existing session string in `<userId>:<jwt>` format.

## What You Get

- Balethon-style handlers: `on_message`, `on_command`, conditions like `all(private, text)`
- common chat primitives: `get_chat`, `send_message`, `load_history`, `load_dialogs`
- group flows: join, invite, edit title/about, pinned messages, selected moderation methods
- gifts and wallet helpers: `get_wallet`, `send_gift`, `open_gift`
- lower-level access: `invoke()` and `post()` for RPCs you want to experiment with

## Transport Model

`balejs` uses two Bale transport paths:

- websocket RPCs for normal connected client work
- gRPC-web POST calls for authentication and HTTP fallback scenarios


- request payloads are wrapped with the standard 5-byte gRPC-web header
- response payloads are cleaned before protobuf decode
- auth and non-live RPCs can run without a persistent HTTP/2 session

## GitHub Pages

The docs are written as plain Markdown pages in `/docs` with relative links between pages.
If you publish the repository with GitHub Pages, set the Pages source to the `/docs` folder.
