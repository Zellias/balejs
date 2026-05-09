# Client API

[Docs Home](./README.md) | [Objects and Enums](./objects-and-enums.md) | [Gifts and Reports](./gifts-and-reports.md)

This page documents the public `Client` surface in `src/client.ts`.

## Constructor

```js
const client = new Client(auth, options);
```

`auth`:

- phone number such as `+989121234567`
- session string such as `<userId>:<jwt>`

`options`:

- `sessionDir?: string`
- `sessionName?: string`
- `grpc?: GrpcConnectionOptions`
- `websocket?: WebSocketConnectionOptions`

`GrpcConnectionOptions`:

- `baseUrl`
- `origin`
- `appVersion`
- `browserType`
- `browserVersion`
- `osType`
- `userAgent`

`WebSocketConnectionOptions`:

- `websocketUri`
- `origin`
- `timeoutSeconds`
- `appVersion`
- `browserType`
- `browserVersion`
- `osType`

## Event Registration

- `on_message(condition?)`
- `on_command(name, condition?)`
- `on_error(callback)`
- `on_connect(callback)`
- `on_disconnect(callback)`
- `on_initialize(callback)`
- `on_shutdown(callback)`

## Lifecycle

- `connect(): Promise<void>`  
  Connects the client, loads or creates a session, starts the websocket, and resolves `client.user`.

- `disconnect(): Promise<void>`  
  Stops the websocket and closes the gRPC transport wrapper.

- `run(task?): Promise<void>`  
  Connects the client, dispatches lifecycle hooks, then either waits until stopped or runs `task(client)` and stops automatically.

- `stop(): Promise<void>`  
  Stops the client and dispatches shutdown once.

## Authentication

- `start_phone_auth(phoneNumber): Promise<Record<string, any>>`
- `validate_code(transactionHash, code): Promise<Record<string, any>>`
- `validate_password(transactionHash, password): Promise<Record<string, any>>`
- `sign_up(transactionHash, name, password?): Promise<Record<string, any>>`
- `sign_out(): Promise<DefaultResponse>`

These are public low-level helpers. Normal apps usually call `connect()` or `run()`.

## Identity And Peer Lookup

- `get_me(): Promise<User>`  
  Loads the current Bale user from the active session.

- `get_chat(chatId): Promise<User | Chat | undefined>`  
  Resolves a peer by Bale peer id or by search query.

- `load_users(users): Promise<User[]>`  
  Loads lightweight user objects from numeric ids or Bale peer ids.

- `load_full_users(users): Promise<Array<Record<string, any>>>`  
  Loads full user payloads. This is still returned as raw decoded objects.

- `get_full_group(chatId): Promise<Record<string, any> | undefined>`  
  Loads the full group payload for a group or channel peer.

- `search_contacts(query): Promise<Record<string, any>>`  
  Returns the decoded search result object. Its `users` and `groups` arrays are wrapped into `User` and `Chat` instances.

## Messaging

- `load_history(chatId, fromDate = -1, limit = 20): Promise<Message[]>`  
  Loads chat history and wraps the returned messages.

- `send_message(chatId, text): Promise<Message>`  
  Sends a text message and returns a wrapped outbound `Message`.

- `send_multi_media_message(chatId, media): Promise<Message[]>`  
  Sends album/media payloads using Bale `DocumentMessage`-shaped objects.

- `edit_message_text(chatId, messageId, text): Promise<DefaultResponse>`  
  Loads the target message from history, edits its text payload, and sends `UpdateMessage`.

- `delete_message(chatId, messageId): Promise<DefaultResponse>`

- `forward_message(chatId, fromChatId, messageId): Promise<DefaultResponse>`

- `copy_message(chatId, fromChatId, messageId): Promise<Message>`

- `clear_chat(chatId): Promise<DefaultResponse>`

- `message_read(chatId, date = Date.now()): Promise<DefaultResponse>`

## Dialogs

- `load_dialogs(limit = 40, minDate = -1, excludePinned = false): Promise<Record<string, any>>`

This returns the decoded dialog payload with raw `dialogs`, `users`, `groups`, `user_peers`, and `group_peers`.

## Presence

- `set_online(isOnline, duration): Promise<DefaultResponse>`
- `typing(chatId, typingType = 1): Promise<DefaultResponse>`
- `start_typing(chatId, typingType = 1): Promise<DefaultResponse>`
- `stop_typing(chatId, typingType = 1): Promise<DefaultResponse>`

`typingType` is the raw Bale typing enum value.

## User Profile And Config

- `edit_name(name): Promise<DefaultResponse>`
- `edit_nickname(nickname?): Promise<DefaultResponse>`
- `edit_about(about?): Promise<DefaultResponse>`
- `check_nickname(nickname): Promise<boolean>`
- `get_parameters(): Promise<Array<{ key: string; value: string }>>`
- `edit_parameter(key, value?): Promise<DefaultResponse>`

## Groups And Channels

- `join_chat(tokenOrUrl): Promise<Chat>`
- `join_group(tokenOrUrl): Promise<Chat>`  
  Alias of `join_chat()`.

- `join_public_chat(chatId): Promise<Chat>`
- `join_public_group(chatId): Promise<Chat>`  
  Alias of `join_public_chat()`.

- `leave_chat(chatId): Promise<DefaultResponse>`
- `leave_group(chatId): Promise<DefaultResponse>`  
  Alias of `leave_chat()`.

- `get_group_link(chatId): Promise<string | undefined>`
- `get_group_invite_url(chatId): Promise<string | undefined>`  
  Alias of `get_group_link()`.

- `revoke_group_link(chatId): Promise<string | undefined>`
- `revoke_invite_url(chatId): Promise<string | undefined>`  
  Alias of `revoke_group_link()`.

- `invite_users(chatId, userIds): Promise<Record<string, any>>`
- `kick_user(chatId, userId): Promise<DefaultResponse>`
- `remove_user_admin(chatId, userId): Promise<DefaultResponse>`
- `set_member_permissions(chatId, userId, permissions): Promise<DefaultResponse>`
- `unban_user(chatId, userId): Promise<DefaultResponse>`

- `edit_group_title(chatId, title): Promise<DefaultResponse>`
- `edit_group_about(chatId, about): Promise<DefaultResponse>`

- `edit_group_avatar(chatId, file): Promise<Record<string, any>>`  
  `file` shape:

```js
{
  file_id: number,
  access_hash: number,
  file_storage_version?: number
}
```

- `load_group_avatars(chatId): Promise<Record<string, any>[]>`
- `remove_group_avatar(chatId, avatarId?): Promise<DefaultResponse>`

- `load_members(chatId, limit = 50, next?): Promise<Record<string, any>>`
- `get_group_members_count(chatId): Promise<number>`

## Pins

- `load_pinned_messages(chatId): Promise<Message[]>`
- `pin_message(chatId, messageId, justMine = false): Promise<DefaultResponse>`
- `unpin_messages(chatId, messageIds = [], all = false): Promise<DefaultResponse>`

- `pin_group_message(chatId, messageId): Promise<DefaultResponse>`
- `unpin_group_message(chatId, messageId): Promise<DefaultResponse>`
- `remove_single_pin(chatId, messageId): Promise<DefaultResponse>`  
  Alias of `unpin_group_message()`.

- `remove_group_pins(chatId): Promise<DefaultResponse>`
- `remove_all_pins(chatId): Promise<DefaultResponse>`  
  Alias of `remove_group_pins()`.

The messaging-level pin methods and the group-level pin methods map to different Bale RPCs.

## Files

- `get_file(fileId, accessHash): Promise<Record<string, any>>`
- `get_file_url(fileId, accessHash): Promise<Record<string, any>>`  
  Alias of `get_file()`.

- `get_file_upload_url(expectedSize, crc, uid, name, mimeType, exPeer?, sendType?, chunkSize?): Promise<Record<string, any>>`

`get_file()` returns the decoded `GetNasimFileUrl` response.  
`get_file_upload_url()` returns upload metadata, not a completed upload helper.

## Reactions And Views

- `get_messages_views(chatId, messageIds, increment = false): Promise<Record<string, any>>`
- `message_set_reaction(chatId, messageId, code): Promise<Record<string, any>>`

`messageIds` can contain:

- message id strings
- `Message`
- `OtherMessage`

## Wallet And Gifts

- `get_wallet(): Promise<WalletResponse>`
- `get_my_kifpools(): Promise<WalletResponse>`  
  Alias of `get_wallet()`.

- `send_gift(chatId, amount, message, options?): Promise<DefaultResponse>`
- `send_gift_packet_with_wallet(chatId, amount, message, options?): Promise<DefaultResponse>`  
  Alias of `send_gift()`.

- `send_giftpacket(chatId, amount, message, options?): Promise<DefaultResponse>`  
  Alias of `send_gift()`.

- `open_gift(message, receiverToken?): Promise<PacketResponse>`
- `open_gift_packet(message, receiverToken?): Promise<PacketResponse>`  
  Alias of `open_gift()`.

- `open_packet(message, receiverToken?): Promise<PacketResponse>`  
  Alias of `open_gift()`.

`send_gift()` options:

- `gift_count?: number`
- `giving_type?: GivingType`
- `show_amounts?: boolean`
- `token?: string`

## Reports

- `report_chat(chatId, reason?, kind?, source?): Promise<DefaultResponse>`
- `report_messages(chatId, messages, reason?, kind?): Promise<DefaultResponse>`
- `report_message(chatId, message, reason?, kind?): Promise<DefaultResponse>`

## Low-level Transport

- `invoke(serviceName, method, requestType, responseType, payload): Promise<T>`
- `post(serviceName, method, requestType, responseType, payload): Promise<T>`

Use `invoke()` when you want the client to use the active websocket if connected and fall back to HTTP otherwise.

Use `post()` when you explicitly want the gRPC-web request path.

## Return Type Notes

Some methods still return raw decoded payloads rather than wrapped first-class model types. The main cases are:

- `start_phone_auth()`
- `validate_code()`
- `validate_password()`
- `sign_up()`
- `load_full_users()`
- `get_full_group()`
- `search_contacts()`
- `load_dialogs()`
- `invite_users()`
- `edit_group_avatar()`
- `load_group_avatars()`
- `load_members()`
- `get_file()`
- `get_file_upload_url()`
- `get_messages_views()`
- `message_set_reaction()`
- `invoke()`
- `post()`

## Important Formats

Peer ids:

```text
<id>|<type>
```

Message ids:

```text
<rid>|<date>
```
