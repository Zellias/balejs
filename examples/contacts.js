const { attachDefaultErrorHandler, createClient, requireEnv } = require("./_shared");

const query = requireEnv(
  "BALE_QUERY",
  'Use a phone number, username, or name fragment. Example: BALE_QUERY="@username".',
);

const client = attachDefaultErrorHandler(createClient());

client.run(async function main(current) {
  const results = await current.search_contacts(query);
  const users = results.users ?? [];
  const groups = results.groups ?? [];

  console.log("query:", query);
  console.log("users:", users.length);
  for (const user of users) {
    console.log(`- ${user.id}|1 ${user.full_name || user.username || "unknown user"}`);
  }

  console.log("groups:", groups.length);
  for (const group of groups) {
    console.log(`- ${group.id} ${group.full_name || group.username || "unknown group"}`);
  }
});
