# Client API

[Docs Home](./README.md) | [Handlers and Conditions](./handlers-and-conditions.md) | [Objects and Enums](./objects-and-enums.md)

## Core Lifecycle

- `connect()`
- `disconnect()`
- `run(task?)`
- `stop()`

Use `run()` for normal apps. Use `connect()` and `disconnect()` if you want explicit lifecycle control.

## Identity and Peer Loading

- `get_me(): Promise<User>`
- `get_chat(chatId: string): Promise<User | Chat | undefined>`

`chatId` uses Bale peer syntax:

```text
<id>|<type>
```

Examples:

- `"12345|1"` for a user peer
- `"67890|2"` for a group peer

## Messaging

- `load_history(chatId, fromDate = -1, limit = 20)`
- `send_message(chatId, text)`
- `edit_message_text(chatId, messageId, text)`
- `delete_message(chatId, messageId)`
- `forward_message(chatId, fromChatId, messageId)`
- `copy_message(chatId, fromChatId, messageId)`

Message ids use this format:

```text
<rid>|<date>
```

## Presence

- `set_online(isOnline, duration)`
- `start_typing(chatId, typingType = 1)`
- `stop_typing(chatId, typingType = 1)`

## Dialogs and Groups

- `load_dialogs(limit = 40, minDate = -1, excludePinned = false)`
- `join_chat(tokenOrUrl)`
- `join_public_chat(chatId)`
- `leave_chat(chatId)`
- `get_group_link(chatId)`
- `revoke_group_link(chatId)`
- `invite_users(chatId, userIds)`
- `edit_group_title(chatId, title)`
- `edit_group_about(chatId, about)`
- `load_members(chatId, limit = 50, next?)`
- `get_group_members_count(chatId)`
- `load_pinned_messages(chatId)`
- `pin_group_message(chatId, messageId)`
- `unpin_group_message(chatId, messageId)`
- `remove_group_pins(chatId)`

## Files

- `get_file(fileId, accessHash)`
- `get_file_upload_url(expectedSize, crc, uid, name, mimeType, exPeer?, sendType?, chunkSize?)`

`get_file_upload_url` is lower-level right now. It gives you the Bale upload target metadata, not a finished high-level upload helper.

## Wallet and Gifts

- `get_wallet()`
- `send_gift(chatId, amount, message, options?)`
- `open_gift(message, receiverToken?)`

`send_gift` options:

- `gift_count`
- `giving_type`
- `show_amounts`
- `token`

## Reports

- `report_chat(chatId, reason?, kind?, source?)`
- `report_message(chatId, message, reason?, kind?)`
- `report_messages(chatId, messages, reason?, kind?)`

## Low-Level Access

- `invoke(serviceName, method, requestType, responseType, payload)`

Use `invoke()` only if you need a Bale RPC that is not wrapped yet.

## Example

```js
const chat = await client.get_chat("12345|1");

if (chat) {
  await client.send_message(chat.id, "hello");
  const history = await client.load_history(chat.id, -1, 10);
  console.log(history.length);
}
```
