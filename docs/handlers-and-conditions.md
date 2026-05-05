# Handlers and Conditions

[Docs Home](./README.md) | [Authentication](./authentication.md) | [Client API](./client-api.md)

## Message Handlers

The primary event entry point is `on_message`.

```js
client.on_message()(async function handle(message) {
  console.log(message.content);
});
```

With a condition:

```js
client.on_message(text)(async function handleText(message) {
  console.log(message.text);
});
```

## Command Handlers

```js
client.on_command("ping")(async function ping(message) {
  await message.reply("pong");
});
```

With extra filtering:

```js
client.on_command("ban", group)(async function ban(message) {
  await message.reply("group-only command");
});
```

## Error Handlers

```js
client.on_error(async function logError(error) {
  console.error(error);
});
```

If you do not register an error handler, thrown handler errors bubble out.

## Lifecycle Hooks

Available lifecycle hooks:

- `on_connect`
- `on_disconnect`
- `on_initialize`
- `on_shutdown`

Example:

```js
client.on_connect(async function ready(current) {
  console.log("connected as", current.user?.id);
});
```

## Built-in Conditions

The library exports these common conditions:

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

## Condition Composition

Use helper functions:

```js
const onlyPrivateText = all(privateChat, text);
const textOrGift = any(text, gift);
const notChannel = not(channel);
```

Or instance methods:

```js
const onlyPrivateText = privateChat.and(text);
const privateOrGroup = privateChat.or(group);
const notGift = gift.not();
```

## Custom Conditions

```js
const fromMe = create(async function fromMe(client, message) {
  return message.author.id === client.user?.id;
}, "fromMe");
```

Then:

```js
client.on_message(all(text, fromMe))(async function selfText(message) {
  console.log(message.text);
});
```

## Balejs vs Balethon Style

In Python Balethon you may write decorators. In this library the equivalent is:

```js
client.on_message(all(privateChat, text))(async function handler(message) {
  await message.reply(message.text);
});
```
