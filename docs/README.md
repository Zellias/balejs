# balejs Docs

This documentation set is written as plain Markdown for GitHub browsing and GitHub Pages publishing from the `/docs` folder.

`balejs` is a Bale userbot library for Node.js and TypeScript with an API designed to feel close to Balethon.

## Pages

- [Getting Started](./getting-started.md)
- [Authentication](./authentication.md)
- [Handlers and Conditions](./handlers-and-conditions.md)
- [Client API](./client-api.md)
- [Objects and Enums](./objects-and-enums.md)
- [Gifts and Reports](./gifts-and-reports.md)
- [Troubleshooting](./troubleshooting.md)

## What This Library Is

The core ideas are:

- `Client`
- `on_message`
- `on_command`
- `send_message`
- `get_chat`
- `message.reply()`

It is focused on the userbot side, not the bot API side.

Current strengths:

- interactive phone auth plus reusable saved sessions
- websocket update handling
- gRPC-web POST fallback for auth and selected RPC calls
- gifts, wallet, reports, dialogs, groups, and selected moderation flows

## Compatibility Notes

Python and JavaScript differ in two important ways:

1. Python decorators like `@client.on_message()` become `client.on_message()(handler)`.
2. Python condition chaining like `private & text` becomes `all(private, text)` or `private.and(text)`.

## Quick Example

```js
const { Client, all, private: privateChat, text } = require("../dist");

const auth = process.env.BALE_SESSION || process.env.BALE_PHONE;

if (!auth) {
  throw new Error("Set BALE_PHONE or BALE_SESSION before running examples.");
}

const client = new Client(auth);

client.on_message(all(privateChat, text))(async function echo(message) {
  await message.reply(message.text);
});

client.run();
```

## Recommended Reading Order

1. [Getting Started](./getting-started.md)
2. [Authentication](./authentication.md)
3. [Handlers and Conditions](./handlers-and-conditions.md)
4. [Client API](./client-api.md)
5. [Objects and Enums](./objects-and-enums.md)
6. [Gifts and Reports](./gifts-and-reports.md)
7. [Troubleshooting](./troubleshooting.md)
