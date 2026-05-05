import type { Condition } from "../conditions";
import type { Client } from "../client";
import type { Message } from "../objects";

type MaybePromise<T> = T | Promise<T>;
type LifecycleEvent = "connect" | "disconnect" | "initialize" | "shutdown";

type MessageCallback = (message: Message, client: Client) => MaybePromise<unknown>;
type ErrorCallback = (error: unknown, client: Client) => MaybePromise<unknown>;
type LifecycleCallback = (client: Client) => MaybePromise<unknown>;

interface MessageHandler {
  callback: MessageCallback;
  condition?: Condition<Message>;
}

export class Dispatcher {
  private readonly messageHandlers: MessageHandler[] = [];
  private readonly errorHandlers: ErrorCallback[] = [];
  private readonly lifecycleHandlers: Record<LifecycleEvent, LifecycleCallback[]> = {
    connect: [],
    disconnect: [],
    initialize: [],
    shutdown: [],
  };

  addMessageHandler(callback: MessageCallback, condition?: Condition<Message>): MessageCallback {
    this.messageHandlers.push({ callback, condition });
    return callback;
  }

  addErrorHandler(callback: ErrorCallback): ErrorCallback {
    this.errorHandlers.push(callback);
    return callback;
  }

  addLifecycleHandler(event: LifecycleEvent, callback: LifecycleCallback): LifecycleCallback {
    this.lifecycleHandlers[event].push(callback);
    return callback;
  }

  async dispatchMessage(client: Client, message: Message): Promise<void> {
    if (this.messageHandlers.length === 0) {
      return;
    }

    for (const handler of this.messageHandlers) {
      try {
        if (handler.condition && !(await handler.condition.matches(client, message))) {
          continue;
        }

        await handler.callback(message, client);
      } catch (error) {
        await this.dispatchError(client, error);
      }
    }
  }

  async dispatchError(client: Client, error: unknown): Promise<void> {
    if (this.errorHandlers.length === 0) {
      throw error;
    }

    for (const handler of this.errorHandlers) {
      await handler(error, client);
    }
  }

  async dispatchLifecycle(event: LifecycleEvent, client: Client): Promise<void> {
    if (this.lifecycleHandlers[event].length === 0) {
      return;
    }

    for (const handler of this.lifecycleHandlers[event]) {
      await handler(client);
    }
  }
}
