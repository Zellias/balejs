# balejs Docs

This is the documentation set for `balejs`, the Bale user library created by [Zellias](https://github.com/zellias).

## Pages

- [Getting Started](./getting-started.md)
- [Authentication](./authentication.md)
- [Handlers and Conditions](./handlers-and-conditions.md)
- [Client API](./client-api.md)
- [Objects and Enums](./objects-and-enums.md)
- [Gifts and Reports](./gifts-and-reports.md)
- [Troubleshooting](./troubleshooting.md)

## Summary

`balejs` is a Node.js library for real Bale user sessions. It provides:

- `Client`
- message handlers and conditions
- wrapped `User`, `Chat`, and `Message` objects
- websocket RPC and gRPC-web POST transports
- helpers for groups, files, gifts, wallet, reports, and direct RPC access

## Start Here

1. [Getting Started](./getting-started.md)
2. [Authentication](./authentication.md)
3. [Handlers and Conditions](./handlers-and-conditions.md)
4. [Client API](./client-api.md)
5. [Objects and Enums](./objects-and-enums.md)

## Quick Example

```js
const { Client, all, private: privateChat, text } = require("../dist");

const auth = process.env.BALE_SESSION || process.env.BALE_PHONE;
const client = new Client(auth);

client.on_message(all(privateChat, text))(async function echo(message) {
  await message.reply(message.text);
});

client.run();
```
