const { Client, all, gift, private: privateChat } = require("../dist");

const auth = process.env.BALE_SESSION || process.env.BALE_PHONE;

if (!auth) {
  throw new Error(
    "Set BALE_PHONE or BALE_SESSION before running the gift example.",
  );
}

const client = new Client(auth);

client.on_message(all(gift, privateChat))(async function handleGift(message) {
  await message.open_gift();

  if (!message.gift) {
    return;
  }

  await message.reply("Thanks. Sending it back.");
  await client.send_gift(message.chat.id, message.gift.total_amount, "Thanks.", {
    gift_count: message.gift.count || 1,
    giving_type: message.gift.giving_type,
    show_amounts: message.gift.show_amounts,
  });
});

client.on_error(async function logError(error) {
  console.error(error);
});

client.run();
