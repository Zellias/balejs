const { attachDefaultErrorHandler, createClient, parseNumberEnv, requireEnv } = require("./_shared");

const chatId = requireEnv("BALE_CHAT_ID", 'Expected a Bale peer id like "12345|1".');
const limit = process.env.BALE_HISTORY_LIMIT ? parseNumberEnv("BALE_HISTORY_LIMIT") : 10;

const client = attachDefaultErrorHandler(createClient());

client.run(async function main(current) {
  const messages = await current.load_history(chatId, -1, limit);

  console.log(`history for ${chatId}: ${messages.length} messages`);
  for (const message of messages) {
    const text = message.content || "<non-text>";
    console.log(`- ${message.id} author=${message.author.id} text=${JSON.stringify(text)}`);
  }
});
