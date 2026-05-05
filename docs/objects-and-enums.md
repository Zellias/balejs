# Objects and Enums

[Docs Home](./README.md) | [Client API](./client-api.md) | [Gifts and Reports](./gifts-and-reports.md)

## `User`

Fields:

- `id`
- `username`
- `name`
- `isBot`
- `full_name`

`User` objects are returned by `get_me()` and sometimes by `get_chat()`.

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
- `report(reason?, kind?)`

## `Message`

Fields:

- `rid`
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

- `reply(text)`
- `edit_text(text)`
- `delete()`
- `forward(chatId)`
- `copy(chatId)`
- `open_gift(receiverToken?)`
- `report(reason?, kind?)`

## Gift Models

### `GiftPacket`

Fields:

- `count`
- `total_amount`
- `giving_type`
- `token`
- `message`
- `owner_id`
- `show_amounts`

### `Winner`

Fields:

- `id`
- `amount`
- `date`

### `PacketResponse`

Fields:

- `receivers`
- `status`
- `openned_count`
- `win_amount`
- `rank`

### `Wallet`

Fields:

- `is_merchant`
- `app`
- `balance`
- `token`
- `level`
- `pan`
- `account`

### `WalletResponse`

Fields:

- `wallet`
- `first_name`
- `last_name`

## Other Models

### `DefaultResponse`

Fields:

- `seq`
- `date`

### `OtherMessage`

Fields:

- `date`
- `message_id`
- `seq`

Useful when you want to report or refer to a message without needing a full wrapped `Message`.

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
