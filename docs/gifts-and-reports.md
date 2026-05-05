# Gifts and Reports

[Docs Home](./README.md) | [Objects and Enums](./objects-and-enums.md) | [Troubleshooting](./troubleshooting.md)

## Gifts

Gift support is available in the userbot layer through wallet and message methods.

## Read Wallet Info

```js
const wallet = await client.get_wallet();
console.log(wallet.wallet?.balance);
```

## Send a Gift

```js
const { GivingType } = require("../dist");

await client.send_gift("12345|1", 10000, "Enjoy.", {
  gift_count: 2,
  giving_type: GivingType.SAME,
  show_amounts: true,
});
```

## Open a Gift From a Message

Incoming gift packets appear on `message.gift`.

```js
client.on_message(gift)(async function handleGift(message) {
  const result = await message.open_gift();
  console.log(result.status, result.win_amount);
});
```

The full example is in [examples/gift.js](../examples/gift.js).

## Gift Notes

- sending or opening gifts requires a wallet token
- if you do not pass a token manually, the client fetches it from `get_wallet()`
- `message.gift` is only present for gift messages

## Reports

The library supports peer-level and message-level reports.

## Report a Chat

```js
const { ReportKind } = require("../dist");

await client.report_chat("12345|1", "spam account", ReportKind.SPAM);
```

## Report One Message

```js
await client.report_message(message.chat.id, message, "abuse", ReportKind.INAPPROPRIATE_CONTENT);
```

## Report Multiple Messages

```js
await client.report_messages(message.chat.id, [message1, message2], "spam wave");
```

## Convenience Methods

You can also use:

- `message.report()`
- `chat.report()`

Example:

```js
await message.report("spam", ReportKind.SPAM);
```

## Reporting Enums

Main report enums:

- `ReportKind`
- `PeerSource`
