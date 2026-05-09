const { BotClient } = require("../dist");

const token = process.env.BALE_BOT_TOKEN;
const providerToken = process.env.BALE_PROVIDER_TOKEN;

if (!token) {
  throw new Error("Set BALE_BOT_TOKEN before running this example.");
}

if (!providerToken) {
  throw new Error("Set BALE_PROVIDER_TOKEN before running this example.");
}

const bot = new BotClient(token, {
  allowedUpdates: ["message", "pre_checkout_query", "shipping_query"],
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

bot.on_pre_checkout_query(async (query, client) => {
  await client.answer_pre_checkout_query(query.id, true);
});

bot.on_successful_payment(async (payment) => {
  console.log("successful payment", payment);
});

bot.on_message(async (message, client) => {
  const text = typeof message.text === "string" ? message.text : "";
  const chatId = message.chat?.id;

  if (!chatId || text !== "/buy") {
    return;
  }

  await client.send_invoice(chatId, {
    title: "Premium",
    description: "Premium subscription",
    payload: "premium:monthly",
    provider_token: providerToken,
    currency: "IRR",
    prices: [{ label: "Premium", amount: 100000 }],
  });
});

bot.on_error(async (error) => {
  console.error(error);
});

bot.run();
