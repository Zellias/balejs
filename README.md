# balejs

TypeScript Bale userbot library modeled on the userbot section of `Balethon-main`.

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

## Scope

This package is focused on Bale userbot workflows:

- phone and session authentication
- websocket updates
- Balethon-style handlers
- text messaging and history
- gifts, wallet, and reports
- selected group and file methods

## GitHub Pages

The docs are written as plain Markdown pages in `/docs` with relative links between pages.
If you publish the repository with GitHub Pages, set the Pages source to the `/docs` folder.
