const { private: privateChat } = require("../dist");
const { attachDefaultErrorHandler, createClient } = require("./_shared");

const client = attachDefaultErrorHandler(createClient());

client.on_command("ping", privateChat)(async function ping(message) {
  await message.reply("pong");
});

client.run();
