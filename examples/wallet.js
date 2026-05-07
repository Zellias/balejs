const { attachDefaultErrorHandler, createClient } = require("./_shared");

const client = attachDefaultErrorHandler(createClient());

client.run(async function main(current) {
  const wallet = await current.get_wallet();

  console.log("balance:", wallet.wallet?.balance ?? 0);
  console.log("level:", wallet.wallet?.level ?? 0);
  console.log("owner:", [wallet.first_name, wallet.last_name].filter(Boolean).join(" ") || "unknown");
  console.log("token available:", Boolean(wallet.wallet?.token));
});
