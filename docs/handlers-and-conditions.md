# Handlers and Conditions

[Docs Home](./README.md) | [Client API](./client-api.md) | [Objects and Enums](./objects-and-enums.md)

## Message Handlers

Register a handler with no filter:

```js
client.on_message()(async function handle(message) {
  console.log(message.content);
});
```

Register a handler with a condition:

```js
client.on_message(text)(async function handleText(message) {
  console.log(message.text);
});
```

Handler signature:

```js
async function handler(message, client) {}
```

## Command Handlers

Use `on_command(name, extraCondition?)`:

```js
client.on_command("ping")(async function ping(message) {
  await message.reply("pong");
});
```

With an extra filter:

```js
client.on_command("ban", group)(async function ban(message) {
  console.log(message.chat.id);
});
```

## Error Handlers

```js
client.on_error(async function logError(error, client) {
  console.error(error);
});
```

If you do not register an error handler, handler failures still propagate through the client flow.

## Lifecycle Hooks

Available lifecycle registrations:

- `on_connect(callback)`
- `on_disconnect(callback)`
- `on_initialize(callback)`
- `on_shutdown(callback)`

Example:

```js
client.on_connect(async function ready(current) {
  console.log("connected as", current.user?.id);
});
```

## Built-in Conditions

Exported message conditions:

- `text`
- `content`
- `gift`
- `private`
- `group`
- `channel`

Examples:

```js
client.on_message(privateChat)(async function onlyPrivate(message) {
  console.log(message.chat.id);
});
```

```js
client.on_message(all(group, text))(async function groupText(message) {
  console.log(message.text);
});
```

## Condition Helpers

Exported helpers:

- `all(...conditions)`
- `any(...conditions)`
- `not(condition)`
- `create(predicate, label?)`

Examples:

```js
const onlyPrivateText = all(privateChat, text);
const textOrGift = any(text, gift);
const notChannel = not(channel);
```

## Condition Methods

Every `Condition` also supports:

- `condition.and(other)`
- `condition.or(other)`
- `condition.not()`
- `condition.matches(client, event)`

Example:

```js
const privateText = privateChat.and(text);
```

## Custom Conditions

```js
const fromMe = create(async function fromMe(client, message) {
  return message.author.id === client.user?.id;
}, "fromMe");

client.on_message(all(text, fromMe))(async function selfText(message) {
  console.log(message.text);
});
```

Predicate signature:

```js
async function predicate(client, event) {
  return true;
}
```

## Command Condition Helper

The package also exports `command(name, prefix?, minArguments?, maxArguments?)` as a condition builder.

Example:

```js
const adminKick = command("kick", "/", 1, 1).and(group);

client.on_message(adminKick)(async function kick(message) {
  console.log(message.text);
});
```

## Notes

- conditions are async-safe
- handlers receive wrapped `Message` objects
- updates with `rid === 0` are ignored by the client before dispatch
