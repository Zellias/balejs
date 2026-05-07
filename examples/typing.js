const { attachDefaultErrorHandler, createClient, parseNumberEnv, requireEnv } = require("./_shared");

const chatId = requireEnv("BALE_CHAT_ID", 'Expected a Bale peer id like "12345|1".');
const seconds = process.env.BALE_TYPING_SECONDS ? parseNumberEnv("BALE_TYPING_SECONDS") : 5;

const client = attachDefaultErrorHandler(createClient());

client.run(async function main(current) {
  await current.set_online(true, seconds + 5);
  await current.start_typing(chatId);
  console.log(`typing in ${chatId} for ${seconds} seconds`);
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  await current.stop_typing(chatId);
  console.log("typing stopped");
});
