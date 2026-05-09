# balejs

`balejs` is a Node.js Bale library created by [Zellias](https://github.com/zellias).

It supports both real Bale user sessions and the official Bale Bot API. The library provides:

- interactive phone authentication and reusable session login
- websocket updates for live handlers and RPC calls
- gRPC-web POST fallback for auth and direct RPC usage
- official Bale Bot API support over `https://tapi.bale.ai/bot<TOKEN>/METHOD`
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
- `BotClient`
- `BotInputFile`
- bot payload types such as `BotUpdate`, `BotMessage`, `BotCallbackQuery`, `BotPreCheckoutQuery`, `BotSuccessfulPayment`, `BotFile`
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
- HTTP Bot API requests for normal bots through `BotClient`

Use `invoke()` when you want the client to use the active websocket if connected and fall back to HTTP otherwise. Use `post()` when you explicitly want the gRPC-web request path.

## Bot Quick Start

```js
const { BotClient } = require("./dist");

const token = process.env.BALE_BOT_TOKEN;

if (!token) {
  throw new Error("Set BALE_BOT_TOKEN to your Bale bot token.");
}

const bot = new BotClient(token);

bot.on_message(async (message, client) => {
  const text = typeof message.text === "string" ? message.text : "";
  const chatId = message.chat?.id;
  if (!chatId || !text) return;
  await client.send_message(chatId, `echo: ${text}`);
});

bot.on_error(async (error) => {
  console.error(error);
});

bot.run();
```

`BotClient` includes long polling with `getUpdates()` and thin wrappers for common official methods such as:

- `get_me()`
- `get_updates()`
- `set_webhook()`
- `delete_webhook()`
- `send_message()`
- `forward_message()`
- `copy_message()`
- `send_photo()`
- `send_document()`
- `send_video()`
- `send_animation()`
- `send_audio()`
- `send_voice()`
- `send_media_group()`
- `edit_message_text()`
- `delete_message()`
- `get_chat()`
- `get_chat_member()`
- `ban_chat_member()`
- `answer_callback_query()`
- `ask_review()`
- `answer_shipping_query()`
- `answer_pre_checkout_query()`
- `send_invoice()`
- `create_invoice_link()`
- `inquire_transaction()`

For methods not wrapped yet, use `bot.request("MethodName", payload)`.

For better reliability under weak networks, `BotClient` also supports:

- `requestTimeoutMs`
- `maxRetries`
- `retryBaseDelayMs`

It also exposes documented update hooks plus higher-level message subtype hooks such as:

- `on_message()`
- `on_edited_message()`
- `on_callback_query()`
- `on_pre_checkout_query()`
- `on_successful_payment()`
- `on_text()`
- `on_photo()`
- `on_document()`
- `on_location()`

## Docs

Full docs live in [docs/README.md](./docs/README.md).

- [Getting Started](./docs/getting-started.md)
- [Authentication](./docs/authentication.md)
- [Bot API](./docs/bot-api.md)
- [Handlers and Conditions](./docs/handlers-and-conditions.md)
- [Client API](./docs/client-api.md)
- [Objects and Enums](./docs/objects-and-enums.md)
- [Gifts and Reports](./docs/gifts-and-reports.md)
- [Troubleshooting](./docs/troubleshooting.md)

## Examples

- [examples/echo.js](./examples/echo.js)
- [examples/bot-echo.js](./examples/bot-echo.js)
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
