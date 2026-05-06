# Client API

[Docs Home](./README.md) | [Handlers and Conditions](./handlers-and-conditions.md) | [Objects and Enums](./objects-and-enums.md)

## Core Lifecycle

- `connect()`
- `disconnect()`
- `run(task?)`
- `stop()`

Use `run()` for normal apps. Use `connect()` and `disconnect()` if you want explicit lifecycle control.

## Authentication and Session Management

- `start_phone_auth(phoneNumber)`
- `validate_code(transactionHash, code)`
- `validate_password(transactionHash, password)`
- `sign_up(transactionHash, name, password?)`
- `sign_out()`

## Identity and Peer Loading

- `get_me(): Promise<User>`
- `get_chat(chatId: string): Promise<User | Chat | undefined>`
- `load_users(users: Array<number | string>): Promise<User[]>`
- `get_full_group(chatId: string): Promise<Record<string, any> | undefined>`

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
- `clear_chat(chatId)`
- `message_read(chatId, date = Date.now())`

Message ids use this format:

```text
<rid>|<date>
```

## Presence

- `set_online(isOnline, duration)`
- `typing(chatId, typingType = 1)`
- `start_typing(chatId, typingType = 1)`
- `stop_typing(chatId, typingType = 1)`

## Dialogs and Groups

- `load_dialogs(limit = 40, minDate = -1, excludePinned = false)`
- `join_chat(tokenOrUrl)`
- `join_group(tokenOrUrl)`
- `join_public_chat(chatId)`
- `join_public_group(chatId)`
- `leave_chat(chatId)`
- `get_group_link(chatId)`
- `get_group_invite_url(chatId)`
- `revoke_group_link(chatId)`
- `revoke_invite_url(chatId)`
- `invite_users(chatId, userIds)`
- `edit_group_title(chatId, title)`
- `edit_group_about(chatId, about)`
- `load_members(chatId, limit = 50, next?)`
- `get_group_members_count(chatId)`
- `load_pinned_messages(chatId)`
- `pin_message(chatId, messageId, justMine = false)`
- `unpin_messages(chatId, messageIds = [], all = false)`
- `pin_group_message(chatId, messageId)`
- `remove_single_pin(chatId, messageId)`
- `unpin_group_message(chatId, messageId)`
- `remove_group_pins(chatId)`
- `remove_all_pins(chatId)`
- `kick_user(chatId, userId)`
- `remove_user_admin(chatId, userId)`
- `set_member_permissions(chatId, userId, permissions)`
- `unban_user(chatId, userId)`

## User Profile and Config

- `edit_name(name)`
- `edit_nickname(nickname?)`
- `edit_about(about?)`
- `check_nickname(nickname): Promise<boolean>`
- `get_parameters()`
- `edit_parameter(key, value?)`

## Files

- `get_file(fileId, accessHash)`
- `get_file_url(fileId, accessHash)`
- `get_file_upload_url(expectedSize, crc, uid, name, mimeType, exPeer?, sendType?, chunkSize?)`

`get_file_upload_url` is lower-level right now. It gives you the Bale upload target metadata, not a finished high-level upload helper.

## Wallet and Gifts

- `get_wallet()`
- `get_my_kifpools()`
- `send_gift(chatId, amount, message, options?)`
- `send_gift_packet_with_wallet(chatId, amount, message, options?)`
- `open_gift(message, receiverToken?)`
- `open_gift_packet(message, receiverToken?)`

`send_gift` options:

- `gift_count`
- `giving_type`
- `show_amounts`
- `token`

## Reactions and Views

- `get_messages_views(chatId, messageIds, increment = false)`
- `message_set_reaction(chatId, messageId, code)`

## Reports

- `report_chat(chatId, reason?, kind?, source?)`
- `report_message(chatId, message, reason?, kind?)`
- `report_messages(chatId, messages, reason?, kind?)`

## Low-Level Access

- `invoke(serviceName, method, requestType, responseType, payload)`
- `post(serviceName, method, requestType, responseType, payload)`

Use `invoke()` only if you need a Bale RPC that is not wrapped yet.

Use `post()` when you explicitly want the gRPC-web POST path instead of the websocket path.

## Transport Notes

- After `connect()`, most wrapped methods use websocket RPCs.
- Authentication uses gRPC-web POST requests.
- `post()` is also available as a public escape hatch for non-live RPC experiments.

## Example

```js
const chat = await client.get_chat("12345|1");

if (chat) {
  await client.send_message(chat.id, "hello");
  const history = await client.load_history(chat.id, -1, 10);
  await client.message_read(chat.id);
  console.log(history.length);
}
```
