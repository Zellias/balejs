const { attachDefaultErrorHandler, createClient, parseNumberEnv } = require("./_shared");

const limit = process.env.BALE_DIALOG_LIMIT ? parseNumberEnv("BALE_DIALOG_LIMIT") : 10;

const client = attachDefaultErrorHandler(createClient());

client.run(async function main(current) {
  const response = await current.load_dialogs(limit);
  const dialogs = Array.isArray(response.dialogs) ? response.dialogs : [];

  console.log("dialogs loaded:", dialogs.length);

  for (const dialog of dialogs.slice(0, limit)) {
    const peer = dialog.peer ? `${dialog.peer.id}|${dialog.peer.type}` : "unknown";
    const updatedAt = dialog.updated_at ?? dialog.date ?? "unknown";
    console.log(`- ${peer} updated_at=${updatedAt}`);
  }
});
