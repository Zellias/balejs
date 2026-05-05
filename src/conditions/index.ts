import { ChatType, type Message } from "../objects";
import { Condition, all, any, create, not } from "./condition";

export { Condition, all, any, create, not };

export const text = new Condition<Message>((_client, message) => {
  return Boolean(message.text);
}, "text");

export const content = new Condition<Message>((_client, message) => {
  return Boolean(message.content);
}, "content");

export const gift = new Condition<Message>((_client, message) => {
  return Boolean(message.gift);
}, "gift");

export const private_ = new Condition<Message>((_client, message) => {
  return message.chat.type === ChatType.PRIVATE;
}, "private");

export const group = new Condition<Message>((_client, message) => {
  return message.chat.type === ChatType.GROUP || message.chat.type === ChatType.SUPERGROUP;
}, "group");

export const channel = new Condition<Message>((_client, message) => {
  return message.chat.type === ChatType.CHANNEL;
}, "channel");

export function command(
  name: string,
  prefix = "/",
  minArguments?: number,
  maxArguments?: number,
): Condition<Message> {
  return new Condition<Message>((_client, message) => {
    if (!message.text) {
      return false;
    }

    const [commandName, ...argumentsList] = message.text.trim().split(/\s+/);
    if (commandName.toLowerCase() !== `${prefix}${name.toLowerCase()}`) {
      return false;
    }

    if (minArguments !== undefined && argumentsList.length < minArguments) {
      return false;
    }

    if (maxArguments !== undefined && argumentsList.length > maxArguments) {
      return false;
    }

    return true;
  }, `command(${name})`);
}

export { private_ as private };
