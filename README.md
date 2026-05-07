# balejs

`balejs` is a Node.js Bale user library created by [Zellias](https://github.com/zellias).

It targets real Bale user sessions, not the bot API. The library provides:

- interactive phone authentication and reusable session login
- websocket updates for live handlers and RPC calls
- gRPC-web POST fallback for auth and direct RPC usage
- messaging, dialogs, groups, files, gifts, reactions, reports, and wallet helpers

## Install

From the repository root:

```bash
npm install
npm run check
npm run build
```

The compiled entry point is `dist/index.js`.

## Quick Start

```js
const { Client, all, private: privateChat, text } = require("./dist");

const auth = process.env.BALE_SESSION || process.env.BALE_PHONE;

if (!auth) {
  throw new Error(
    "Set BALE_PHONE to a real Bale phone number like +989121234567, or set BALE_SESSION to an existing <userId>:<jwt> session string.",
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

## Authentication Inputs

The constructor accepts either:

- a phone number such as `+989121234567`
- a saved session string in `<userId>:<jwt>` format

If you use a phone number, the client runs the Bale phone login flow in the terminal and stores a session file automatically.

## What The Library Exports

Main exports:

- `Client`
- conditions: `all`, `any`, `not`, `create`, `text`, `content`, `gift`, `private`, `group`, `channel`, `command`
- errors: `BaleRpcError`, `AuthenticationError`, `ClientStateError`
- objects and enums: `User`, `Chat`, `Message`, `GiftPacket`, `PacketResponse`, `Wallet`, `WalletResponse`, `DefaultResponse`, `OtherMessage`, `ChatType`, `GivingType`, `GiftOpenning`, `ReportKind`, `PeerSource`

## Common Features

- message handlers with `on_message()`
- command handlers with `on_command()`
- lifecycle hooks: `on_connect()`, `on_disconnect()`, `on_initialize()`, `on_shutdown()`
- peer lookup with `get_chat()`, `load_users()`, `load_full_users()`, `search_contacts()`
- messaging helpers: `send_message()`, `edit_message_text()`, `delete_message()`, `forward_message()`, `copy_message()`
- group helpers: join, leave, invite, permissions, pins, avatars
- wallet and gifts: `get_wallet()`, `send_gift()`, `open_gift()`
- reports: `report_chat()`, `report_message()`, `report_messages()`
- low-level RPC escape hatches: `invoke()` and `post()`

## ID Formats

Peer ids use Bale peer syntax:

```text
<id>|<type>
```

Examples:

- `12345|1` for a private user peer
- `98765|2` for a group peer
- `22222|3` for a channel peer

Message ids use:

```text
<rid>|<date>
```

## Transport Model

`balejs` uses two transport paths:

- websocket RPCs after `connect()` / `run()` for live work and updates
- gRPC-web POST requests for authentication and explicit HTTP fallback

Use `invoke()` when you want the client to use the active websocket if connected and fall back to HTTP otherwise. Use `post()` when you explicitly want the gRPC-web request path.

## Docs

Full docs live in [docs/README.md](./docs/README.md).

- [Getting Started](./docs/getting-started.md)
- [Authentication](./docs/authentication.md)
- [Handlers and Conditions](./docs/handlers-and-conditions.md)
- [Client API](./docs/client-api.md)
- [Objects and Enums](./docs/objects-and-enums.md)
- [Gifts and Reports](./docs/gifts-and-reports.md)
- [Troubleshooting](./docs/troubleshooting.md)

## Examples

- [examples/echo.js](./examples/echo.js)
- [examples/gift.js](./examples/gift.js)
- [examples/command-ping.js](./examples/command-ping.js)
- [examples/contacts.js](./examples/contacts.js)
- [examples/dialogs.js](./examples/dialogs.js)
- [examples/forward-message.js](./examples/forward-message.js)
- [examples/history.js](./examples/history.js)
- [examples/lifecycle.js](./examples/lifecycle.js)
- [examples/reaction.js](./examples/reaction.js)
- [examples/send-message.js](./examples/send-message.js)
- [examples/typing.js](./examples/typing.js)
- [examples/wallet.js](./examples/wallet.js)

## GitHub Pages

The `/docs` folder is plain Markdown and can be published directly with GitHub Pages.

Developed based on [Balethon](https://github.com/Balethon/Balethon/) for being user friendly with 💗 by [Zellias](https://github.com/zellias)
