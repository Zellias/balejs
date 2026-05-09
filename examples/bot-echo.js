const { BotClient } = require("../dist");

const token = process.env.BALE_BOT_TOKEN;

if (!token) {
  throw new Error("Set BALE_BOT_TOKEN before running this example.");
}

const bot = new BotClient(token);

bot.on_message(async (message, client) => {
  const text = typeof message.text === "string" ? message.text : "";
  const chatId = message.chat?.id;

  if (!chatId || !text) {
    return;
  }

  if (text === "/start") {
    await client.send_message(chatId, "Bot is online.");
    return;
  }

  await client.send_message(chatId, `echo: ${text}`);
});

bot.on_error(async (error) => {
  console.error(error);
});

bot.run();
