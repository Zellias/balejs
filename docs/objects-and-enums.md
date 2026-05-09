# Objects and Enums

[Docs Home](./README.md) | [Client API](./client-api.md) | [Gifts and Reports](./gifts-and-reports.md)

This page covers the exported object wrappers and enums from `src/objects/index.ts`.

## `User`

Fields:

- `id`
- `username`
- `name`
- `isBot`
- `full_name`

Notes:

- `full_name` returns `name ?? ""`
- `User` instances are bound to a client when they come from wrapped client methods

## `Chat`

Fields:

- `peerId`
- `peerType`
- `id`
- `title`
- `username`
- `firstName`
- `lastName`
- `type`
- `full_name`

Methods:

- `send(text)`
- `load_history(limit?, fromDate?)`
- `send_gift(amount, message, options?)`
- `send_giftpacket(amount, message, options?)`
- `report(reason?, kind?)`

`id` is the Bale peer id string:

```text
<id>|<type>
```

## `Message`

Fields:

- `rid`
- `message_id`
- `date`
- `id`
- `author`
- `chat`
- `text`
- `caption`
- `gift`
- `raw`
- `content`

Methods:

- `answer(text)`
- `reply(text)`
- `edit_text(text)`
- `delete(just_me?)`
- `seen()`
- `clear_chat()`
- `delete_chat()`
- `load_history(limit?, fromDate?)`
- `pin(just_mine?)`
- `unpin()`
- `unpin_all()`
- `pin_in_group()`
- `unpin_in_group()`
- `unpin_all_in_group()`
- `load_pinned_messages()`
- `load_full_chat()`
- `forward(chatId)`
- `copy(chatId)`
- `open_gift(receiverToken?)`
- `open_packet(receiverToken?)`
- `report(reason?, kind?)`

Notes:

- `message_id` is an alias for `rid`
- `id` is the Bale message id string:

```text
<rid>|<date>
```

- `content` returns `text ?? caption ?? ""`
- `reply(text)` sends an actual Bale reply reference; use `answer(text)` for a plain send in the same chat

## `GiftPacket`

Fields:

- `count`
- `total_amount`
- `giving_type`
- `token`
- `message`
- `owner_id`
- `show_amounts`

## `Winner`

Fields:

- `id`
- `amount`
- `date`

## `PacketResponse`

Fields:

- `receivers`
- `status`
- `openned_count`
- `win_amount`
- `rank`

## `Wallet`

Fields:

- `is_merchant`
- `app`
- `balance`
- `token`
- `level`
- `pan`
- `account`

## `WalletResponse`

Fields:

- `wallet`
- `first_name`
- `last_name`

## `DefaultResponse`

Fields:

- `seq`
- `date`

This is the common wrapper for Bale default responses.

## `OtherMessage`

Fields:

- `date`
- `message_id`
- `seq`

Use `OtherMessage` when you want to refer to a message for reporting or view/reaction calls without needing a fully wrapped `Message`.

## Enums

### `ChatType`

- `PRIVATE`
- `GROUP`
- `CHANNEL`
- `BOT`
- `SUPERGROUP`
- `THREAD`
- `UNKNOWN`

### `GivingType`

- `SAME`
- `RANDOM`

### `GiftOpenning`

- `ALREADY_RECEIVED`
- `SOLD_OUT`
- `GIFT_CREATOR`
- `SUCCESSFUL`
- `PENDING`

### `ReportKind`

- `UNKNOWN`
- `SCAM`
- `INAPPROPRIATE_CONTENT`
- `OTHER`
- `VIOLENCE`
- `SPAM`
- `FALSE_INFORMATION`

### `PeerSource`

- `UNKNOWN`
- `DIALOGS`
- `VITRINE`
- `MARKET`
- `PRIVACY_BAR`

## Helper Functions

Also exported:

- `peerTypeToChatType(peerType)`
- `groupTypeToPeerType(groupType)`
- `wrapUser(raw)`
- `wrapGroup(raw)`
- `wrapMessageFromUpdate(raw, context?)`
- `wrapGiftPacket(raw)`
- `wrapWinner(raw)`
- `wrapPacketResponse(raw)`
- `wrapWallet(raw)`
- `wrapWalletResponse(raw)`
- `wrapDefaultResponse(raw)`

These helpers are mainly useful if you are working with raw decoded Bale payloads through `invoke()` or `post()`.
