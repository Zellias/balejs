# Getting Started

[Docs Home](./README.md) | [Authentication](./authentication.md) | [Client API](./client-api.md)

## Requirements

- Node.js
- a real Bale account
- either a phone number or an existing Bale session string

## Install And Build

From the repository root:

```bash
npm install
npm run check
npm run build
```

The compiled entry point is `dist/index.js`.

## First Client

```js
const { Client, all, private: privateChat, text } = require("../dist");

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

This flow is also shown in [examples/echo.js](../examples/echo.js).

## Constructor

```js
const client = new Client(auth, options);
```

`auth` can be:

- `+989...` style phone input
- `<userId>:<jwt>` session string

`options` supports:

- `sessionDir?: string`
- `sessionName?: string`
- `grpc?: GrpcConnectionOptions`
- `websocket?: WebSocketConnectionOptions`
- `updateConcurrency?: number`

`GrpcConnectionOptions` also supports transport hardening settings:

- `timeoutMs?: number`
- `maxRetries?: number`
- `retryBaseDelayMs?: number`

## Session Storage

By default, sessions are written under the current working directory:

```text
<cwd>/<token-or-phone>.session
```

You can override that:

```js
const client = new Client(auth, {
  sessionDir: "./examples",
  sessionName: "main-account",
});
```

## Connection Styles

### Long-running app

```js
client.run();
```

### Manual lifecycle

```js
await client.connect();
await client.send_message("12345|1", "hello");
await client.disconnect();
```

### Run with a task

```js
await client.run(async function main(current) {
  const me = await current.get_me();
  console.log(me.id);
});
```

When `run(task)` finishes, the client stops automatically.

## ID Formats

Peer ids:

```text
<id>|<type>
```

Common peer types:

- `1` private user
- `2` group
- `3` channel
- `4` bot
- `5` supergroup

Message ids:

```text
<rid>|<date>
```

## Imports

CommonJS:

```js
const { Client, all, text, private: privateChat } = require("../dist");
```

TypeScript:

```ts
import { Client, all, text, private_ as privateChat } from "../dist";
```

The source export is `private_`. The package also re-exports it as `private` for JavaScript consumers.

## Next

- [Authentication](./authentication.md)
- [Handlers and Conditions](./handlers-and-conditions.md)
- [Client API](./client-api.md)
