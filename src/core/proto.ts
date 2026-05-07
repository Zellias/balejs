import path from "node:path";
import protobuf from "protobufjs";

const conversionOptions: protobuf.IConversionOptions = {
  longs: String,
  bytes: Buffer,
  enums: String,
  defaults: false,
};
const shouldVerifyMessages = process.env.BALE_VERIFY_PROTO === "1";
const typeCache = new Map<string, protobuf.Type>();

const protoRoot = new protobuf.Root();
protoRoot.loadSync(
  [
    path.resolve(__dirname, "..", "proto", "struct.proto"),
    path.resolve(__dirname, "..", "proto", "request.proto"),
    path.resolve(__dirname, "..", "proto", "response.proto"),
  ],
  {
    keepCase: true,
  },
);
protoRoot.resolveAll();

function lookupType(typeName: string): protobuf.Type {
  const cachedType = typeCache.get(typeName);
  if (cachedType) {
    return cachedType;
  }

  const messageType = protoRoot.lookupType(typeName);
  typeCache.set(typeName, messageType);
  return messageType;
}

export function encodeMessage(typeName: string, payload: object): Uint8Array {
  const messageType = lookupType(typeName);

  if (shouldVerifyMessages) {
    const err = messageType.verify(payload);
    if (err) {
      throw new TypeError(`Invalid ${typeName} payload: ${err}`);
    }
  }

  return messageType.encode(messageType.create(payload)).finish();
}

export function decodeMessage<T>(typeName: string, payload: Uint8Array): T {
  const messageType = lookupType(typeName);
  const decoded = messageType.decode(payload);
  return messageType.toObject(decoded, conversionOptions) as T;
}

export { protoRoot };
