const { attachDefaultErrorHandler, createClient, requireEnv } = require("./_shared");

const chatId = requireEnv("BALE_CHAT_ID", 'Expected a Bale peer id like "12345|1".');
const text = requireEnv("BALE_TEXT", 'Example: BALE_TEXT="hello from balejs".');

const client = attachDefaultErrorHandler(createClient());

client.run(async function main(current) {
  const message = await current.send_message(chatId, text);
  console.log(`sent ${message.id} to ${message.chat.id}`);
});
