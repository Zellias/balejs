const { Client, all, private: privateChat, text } = require("../dist");

const auth = process.env.BALE_SESSION || process.env.BALE_PHONE;

if (!auth) {
  throw new Error(
    "Set BALE_PHONE to a real phone number like +989121234567, or set BALE_SESSION to an existing <userId>:<jwt> session string.",
  );
}

const bot = new Client(auth);

bot.on_message(all(privateChat, text))(async function echo(message) {
  await message.reply(message.text);
  
});

bot.on_error(async function logError(error) {
  console.error(error);
});

bot.run();
