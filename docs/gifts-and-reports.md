# Gifts and Reports

[Docs Home](./README.md) | [Client API](./client-api.md) | [Objects and Enums](./objects-and-enums.md)

## Wallet

Read wallet info:

```js
const wallet = await client.get_wallet();
console.log(wallet.wallet?.balance);
```

Alias:

```js
const wallet = await client.get_my_kifpools();
```

The wallet token is used automatically by gift helpers when possible.

## Sending Gifts

```js
const { GivingType } = require("../dist");

await client.send_gift("12345|1", 10000, "Enjoy.", {
  gift_count: 2,
  giving_type: GivingType.SAME,
  show_amounts: true,
});
```

Aliases:

```js
await client.send_gift_packet_with_wallet("12345|1", 10000, "Enjoy.");
await client.send_giftpacket("12345|1", 10000, "Enjoy.");
```

Supported options:

- `gift_count`
- `giving_type`
- `show_amounts`
- `token`

If `token` is omitted, the client tries to use `get_wallet().wallet?.token`.

## Opening Gifts

Gift packets appear on `message.gift`.

```js
const { all, gift, private: privateChat } = require("../dist");

client.on_message(all(gift, privateChat))(async function handleGift(message) {
  const result = await message.open_gift();
  console.log(result.status, result.win_amount);
});
```

Aliases:

```js
const result = await client.open_gift_packet(message);
const result2 = await client.open_packet(message);
```

## Gift Result Fields

`PacketResponse` contains:

- `receivers`
- `status`
- `openned_count`
- `win_amount`
- `rank`

`status` is a `GiftOpenning` enum value.

## Gift Notes

- sending gifts requires a wallet token
- opening gifts requires a wallet token
- `message.gift` only exists on gift messages
- `Chat.send_gift()` and `Chat.send_giftpacket()` forward to the client helpers

## Reports

The library supports peer-level and message-level reports.

## Report A Chat

```js
const { ReportKind, PeerSource } = require("../dist");

await client.report_chat("12345|1", "spam account", ReportKind.SPAM, PeerSource.DIALOGS);
```

## Report One Message

```js
await client.report_message(message.chat.id, message, "abuse", ReportKind.INAPPROPRIATE_CONTENT);
```

## Report Multiple Messages

```js
await client.report_messages(message.chat.id, [message1, message2], "spam wave", ReportKind.SPAM);
```

You can mix `Message` and `OtherMessage` instances inside `report_messages()`.

## Convenience Methods

Wrapped objects also expose:

- `message.report(reason?, kind?)`
- `chat.report(reason?, kind?)`

Example:

```js
await message.report("spam", ReportKind.SPAM);
await message.chat.report("spam wave", ReportKind.SPAM);
```

## Report Enums

- `ReportKind`
- `PeerSource`
