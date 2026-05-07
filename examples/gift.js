const { Client, all, gift, private: privateChat } = require("../dist");

const auth = process.env.BALE_SESSION || process.env.BALE_PHONE;

if (!auth) {
  throw new Error(
    "Set BALE_PHONE to a real Bale phone number or set BALE_SESSION to an existing <userId>:<jwt> session string before running the gift example.",
  );
}

const client = new Client(auth);

client.on_message(all(gift, privateChat))(async function handleGift(message) {
  if (!message.gift) {
    return;
  }

  const result = await message.open_gift();
  console.log("gift status:", result.status);
  console.log("win amount:", result.win_amount);
});

client.on_error(async function logError(error) {
  console.error(error);
});

client.run();
