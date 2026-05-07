const { attachDefaultErrorHandler, createClient } = require("./_shared");

const client = attachDefaultErrorHandler(createClient());

client.on_connect(async function onConnect(current) {
  console.log("connect", current.user?.id ?? "unknown");
});

client.on_initialize(async function onInitialize(current) {
  console.log("initialize", current.user?.full_name || current.user?.id || "unknown");
});

client.on_shutdown(async function onShutdown() {
  console.log("shutdown");
});

client.on_disconnect(async function onDisconnect() {
  console.log("disconnect");
});

client.on_command("whoami")(async function whoAmI(message, current) {
  const me = current.user ?? (await current.get_me());
  await message.reply(`you are ${me.full_name || me.username || me.id}`);
});

client.on_command("stop")(async function stop(message, current) {
  await message.reply("stopping client");
  await current.stop();
});

client.run();
