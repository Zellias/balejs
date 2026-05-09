# Bot API

`balejs` exposes the official Bale Bot API through `BotClient`.

It targets the HTTP API documented by Bale at `https://docs.bale.ai` and sends requests to:

```text
https://tapi.bale.ai/bot<TOKEN>/METHOD_NAME
```

## Quick Start

```js
const { BotClient } = require("../dist");

const bot = new BotClient(process.env.BALE_BOT_TOKEN);

bot.on_message(async (message, client) => {
  const text = typeof message.text === "string" ? message.text : "";
  const chatId = message.chat?.id;
  if (!chatId || !text) return;

  if (text === "/start") {
    await client.send_message(chatId, "Bot is online.");
    return;
  }

  await client.send_message(chatId, `You said: ${text}`);
});

bot.on_error(async (error) => {
  console.error("bot error", error);
});

bot.run();
```

## Long Polling

`run()` uses `getUpdates` long polling.

Documented update hooks exposed by `BotClient`:

- `on_update()`
- `on_message()`
- `on_edited_message()`
- `on_callback_query()`
- `on_pre_checkout_query()`

Additional high-level hooks exposed by `balejs` on top of the raw update types:

- `on_successful_payment()`
- `on_text()`
- `on_photo()`
- `on_audio()`
- `on_document()`
- `on_video()`
- `on_animation()`
- `on_voice()`
- `on_sticker()`
- `on_contact()`
- `on_location()`
- `on_invoice()`
- `on_web_app_data()`
- `on_new_chat_members()`
- `on_left_chat_member()`
- `on_channel_post()`
- `on_edited_channel_post()`
- `on_poll()`
- `on_poll_answer()`

Options:

- `pollTimeoutSeconds`
- `pollLimit`
- `pollIntervalMs`
- `allowedUpdates`
- `requestTimeoutMs`
- `maxRetries`
- `retryBaseDelayMs`

Example:

```js
const bot = new BotClient(process.env.BALE_BOT_TOKEN, {
  pollTimeoutSeconds: 20,
  pollLimit: 50,
  allowedUpdates: ["message", "callback_query"],
  requestTimeoutMs: 45000,
  maxRetries: 2,
});
```

You can also feed webhook payloads into the same dispatcher with:

```js
await bot.process_update(req.body);
```

## Common Methods

Official `docs.bale.ai` method coverage in `BotClient`:

- `get_me()`
- `get_updates()`
- `set_webhook(url, options?)`
- `delete_webhook(dropPendingUpdates?)`
- `get_webhook_info()`
- `send_message(chatId, text, options?)`
- `forward_message(chatId, fromChatId, messageId, options?)`
- `copy_message(chatId, fromChatId, messageId, options?)`
- `send_photo(chatId, photo, options?)`
- `send_document(chatId, document, options?)`
- `send_video(chatId, video, options?)`
- `send_animation(chatId, animation, options?)`
- `send_audio(chatId, audio, options?)`
- `send_voice(chatId, voice, options?)`
- `send_media_group(chatId, media, options?)`
- `send_location(chatId, latitude, longitude, options?)`
- `send_contact(chatId, phoneNumber, firstName, options?)`
- `send_chat_action(chatId, action)`
- `edit_message_text(text, options)`
- `edit_message_caption(options)`
- `edit_message_reply_markup(options)`
- `delete_message(chatId, messageId)`
- `ban_chat_member(chatId, userId, options?)`
- `unban_chat_member(chatId, userId, options?)`
- `restrict_chat_member(chatId, userId, options?)`
- `promote_chat_member(chatId, userId, options?)`
- `set_chat_title(chatId, title)`
- `set_chat_description(chatId, description)`
- `pin_chat_message(chatId, messageId, options?)`
- `unpin_chat_message(chatId, messageId?)`
- `leave_chat(chatId)`
- `get_chat(chatId)`
- `get_chat_administrators(chatId)`
- `get_chat_members_count(chatId)`
- `get_chat_member(chatId, userId)`
- `get_file(fileId)`
- `answer_callback_query(callbackQueryId, options?)`
- `ask_review(chatId)`
- `answer_shipping_query(shippingQueryId, ok, options?)`
- `answer_pre_checkout_query(preCheckoutQueryId, ok, options?)`
- `send_invoice(chatId, options)`
- `create_invoice_link(options)`
- `inquire_transaction(orderId)`
- `export_chat_invite_link(chatId)`
- `create_chat_invite_link(chatId, options?)`
- `revoke_chat_invite_link(chatId, inviteLink)`
- `unpin_all_chat_messages(chatId)`
- `upload_sticker_file(userId, sticker, stickerFormat)`
- `create_new_sticker_set(userId, name, title, stickers, options?)`
- `add_sticker_to_set(userId, name, sticker)`

For any documented method that does not have a wrapper yet:

```js
await bot.request("someMethodName", {
  key: "value",
});
```

Bot payload types are also exported, including:

- `BotUpdate`
- `BotMessage`
- `BotCallbackQuery`
- `BotPreCheckoutQuery`
- `BotShippingQuery`
- `BotSuccessfulPayment`
- `BotFile`

## Uploads

Use `BotInputFile` for multipart uploads:

```js
const { BotClient, BotInputFile } = require("../dist");

const bot = new BotClient(process.env.BALE_BOT_TOKEN);
const photo = await BotInputFile.fromPath("./photo.jpg");

await bot.send_photo(123456789, photo, {
  caption: "uploaded from balejs",
});
```

## Payments

Official Bale bot payments revolve around:

- `send_invoice`
- `answer_shipping_query`
- `answer_pre_checkout_query`
- `create_invoice_link`
- `inquire_transaction`

`balejs` now exposes the full lifecycle hooks needed to process payment updates:

- `on_shipping_query()`
- `on_pre_checkout_query()`
- `on_successful_payment()`

Example:

```js
const { BotClient } = require("../dist");

const bot = new BotClient(process.env.BALE_BOT_TOKEN, {
  allowedUpdates: ["message", "pre_checkout_query", "shipping_query"],
});

bot.on_pre_checkout_query(async (query, client) => {
  await client.answer_pre_checkout_query(query.id, true);
});

bot.on_shipping_query(async (query, client) => {
  await client.answer_shipping_query(query.id, true, {
    shipping_options: [
      {
        id: "normal",
        title: "Normal delivery",
        prices: [{ label: "Shipping", amount: 50000 }],
      },
    ],
  });
});

bot.on_successful_payment(async (payment) => {
  console.log("payment ok", payment);
});

await bot.send_invoice(123456789, {
  title: "Premium",
  description: "Premium subscription",
  payload: "premium:monthly",
  currency: "IRR",
  prices: [{ label: "Premium", amount: 100000 }],
});
```

When `getFile` returns a `file_path`, you can build the download URL with:

```js
const file = await bot.get_file(fileId);
const url = bot.get_file_url(file.file_path);
```
