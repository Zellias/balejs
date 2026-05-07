const { attachDefaultErrorHandler, createClient, requireEnv } = require("./_shared");

const targetChatId = requireEnv(
  "BALE_TARGET_CHAT_ID",
  'Expected a Bale peer id like "12345|1".',
);
const sourceChatId = requireEnv(
  "BALE_SOURCE_CHAT_ID",
  'Expected a Bale peer id like "12345|1".',
);
const messageId = requireEnv(
  "BALE_MESSAGE_ID",
  'Expected a Bale message id like "67890|1730000000".',
);

const client = attachDefaultErrorHandler(createClient());

client.run(async function main(current) {
  await current.forward_message(targetChatId, sourceChatId, messageId);
  console.log(`forwarded ${messageId} from ${sourceChatId} to ${targetChatId}`);
});
