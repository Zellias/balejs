# Getting Started

[Docs Home](./README.md) | [Authentication](./authentication.md)

## Requirements

- Node.js with CommonJS support
- a Bale account for userbot login
- either a phone number or an existing Bale session string

## Install

From the repository root:

```bash
npm install
npm run check
npm run build
```

Your compiled library entry point is `dist/index.js`.

## First Echo Client

```js
const { Client, all, private: privateChat, text } = require("../dist");

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

This is the same flow used in [examples/echo.js](../examples/echo.js).

## How The Client Talks To Bale

The library uses:

- websocket RPCs after `connect()` / `run()` for normal live client work
- gRPC-web POST requests for authentication and selected fallback RPCs

That means the same client can:

- prompt for phone login in the terminal
- receive live updates over websocket
- still perform certain non-live RPC flows without relying on an HTTP/2 socket hack

## Running

Use a saved session:

```bash
BALE_SESSION='123456:jwt_here' node examples/echo.js
```

Or use phone auth:

```bash
BALE_PHONE='+989121234567' node examples/echo.js
```

If you use phone auth, the client will prompt for the Bale login code in the terminal.

## Session Files

By default, the client stores sessions under the current working directory:

```text
<cwd>/<token-or-phone>.session
```

You can override that:

```js
const client = new Client(auth, {
  sessionDir: "./examples",
});
```

## Import Patterns

CommonJS:

```js
const { Client, text, private: privateChat, all } = require("../dist");
```

TypeScript:

```ts
import { Client, text, private_ as privateChat, all } from "../dist";
```

`private` is exported as `private_` in the source and re-exported as `private` for JavaScript usage.

## Next Steps

- Read [Authentication](./authentication.md) for login details.
- Read [Handlers and Conditions](./handlers-and-conditions.md) for filters and routing.
- Read [Client API](./client-api.md) for the full method surface.
