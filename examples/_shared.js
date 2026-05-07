const { Client } = require("../dist");

function getAuth() {
  const auth = process.env.BALE_SESSION || process.env.BALE_PHONE;

  if (!auth) {
    throw new Error(
      "Set BALE_PHONE to a real Bale phone number like +989121234567, or set BALE_SESSION to an existing <userId>:<jwt> session string.",
    );
  }

  return auth;
}

function createClient(options) {
  return new Client(getAuth(), options);
}

function attachDefaultErrorHandler(client) {
  client.on_error(async function logError(error) {
    console.error(error);
  });

  return client;
}

function requireEnv(name, hint) {
  const value = process.env[name];
  if (!value) {
    throw new Error(hint ? `Set ${name}. ${hint}` : `Set ${name} before running this example.`);
  }

  return value;
}

function parseNumberEnv(name, hint) {
  const value = requireEnv(name, hint);
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new TypeError(`${name} must be a number. Received "${value}".`);
  }

  return parsed;
}

module.exports = {
  attachDefaultErrorHandler,
  createClient,
  parseNumberEnv,
  requireEnv,
};
