const { attachDefaultErrorHandler, createClient, requireEnv } = require("./_shared");

const chatId = requireEnv("BALE_CHAT_ID", 'Expected a Bale peer id like "12345|1".');
const messageId = requireEnv(
  "BALE_MESSAGE_ID",
  'Expected a Bale message id like "67890|1730000000".',
);
const reactionCode = requireEnv("BALE_REACTION_CODE", 'Example: BALE_REACTION_CODE="👍".');

const client = attachDefaultErrorHandler(createClient());

client.run(async function main(current) {
  const result = await current.message_set_reaction(chatId, messageId, reactionCode);
  console.log("reaction result:", result);
});
