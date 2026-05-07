import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { command, type Condition } from "./conditions";
import { Dispatcher } from "./core/dispatcher";
import { BaleGrpcConnection, type GrpcConnectionOptions } from "./core/grpc";
import { BaleWebSocketConnection, type WebSocketConnectionOptions } from "./core/ws";
import { AuthenticationError, BaleRpcError, ClientStateError } from "./errors";
import {
  Chat,
  DefaultResponse,
  GivingType,
  Message,
  OtherMessage,
  PacketResponse,
  PeerSource,
  ReportKind,
  User,
  WalletResponse,
  wrapGroup,
  wrapDefaultResponse,
  wrapMessageFromUpdate,
  wrapPacketResponse,
  wrapUser,
  wrapWalletResponse,
} from "./objects";

interface SessionState {
  jwt: string;
  userId: number;
}

interface CachedWalletState {
  value: WalletResponse;
  expiresAt: number;
}

const START_PHONE_AUTH_OPTIONS = Buffer.from([0, 1]);
const EMPTY_OPTIMIZATIONS: readonly number[] = [];

export interface ClientOptions {
  sessionDir?: string;
  grpc?: GrpcConnectionOptions;
  websocket?: WebSocketConnectionOptions;
}

export interface FileLocationInput {
  file_id: number;
  access_hash: number;
  file_storage_version?: number;
}

export interface SingleMediaInput {
  random_id?: number | string;
  media: Record<string, any>;
}

type MessageCallback = (message: Message, client: Client) => unknown | Promise<unknown>;
type ErrorCallback = (error: unknown, client: Client) => unknown | Promise<unknown>;
type LifecycleCallback = (client: Client) => unknown | Promise<unknown>;

function isSessionString(value: string): boolean {
  return /^\d+:.+$/.test(value);
}

function parseSessionString(value: string): SessionState {
  const [userId, jwt] = value.trim().split(":", 2);
  return {
    userId: Number(userId),
    jwt,
  };
}

function formatSessionString(session: SessionState): string {
  return `${session.userId}:${session.jwt}`;
}

function normalizeAuthPhoneNumber(phoneNumber: string): number {
  return Number(phoneNumber.replace(/[^\d]/g, ""));
}

function formatPhoneNumberInputHint(phoneNumber: string): string {
  const normalized = phoneNumber.replace(/[^\d]/g, "");
  return normalized ? `Received "${phoneNumber}" -> "${normalized}".` : `Received "${phoneNumber}".`;
}

function normalizeSearchQuery(value: string): string {
  if (value.startsWith("@")) {
    return value.slice(1);
  }

  if (value.startsWith("+")) {
    return value.slice(1);
  }

  if (value.startsWith("https://ble.ir/")) {
    return value.slice("https://ble.ir/".length);
  }

  if (value.startsWith("ble.ir/")) {
    return value.slice("ble.ir/".length);
  }

  return value;
}

function extractJoinToken(value: string): string {
  if (value.startsWith("https://ble.ir/join/")) {
    return value.slice("https://ble.ir/join/".length);
  }

  if (value.startsWith("ble.ir/join/")) {
    return value.slice("ble.ir/join/".length);
  }

  return value;
}

function parsePeerString(value: string): { id: number; type: number } | undefined {
  const match = /^(\d+)\|(\d+)$/.exec(value.trim());
  if (!match) {
    return undefined;
  }

  return {
    id: Number(match[1]),
    type: Number(match[2]),
  };
}

function parseMessageId(value: string): { rid: string; date: number } {
  const match = /^(\d+)\|(\d+)$/.exec(value.trim());
  if (!match) {
    throw new TypeError(`Invalid Bale message id: ${value}`);
  }

  return {
    rid: match[1],
    date: Number(match[2]),
  };
}

export class Client {
  readonly token_or_phone_number: string;
  readonly sessionDir: string;
  readonly dispatcher = new Dispatcher();

  private readonly grpcConnection: BaleGrpcConnection;
  private readonly websocketOptions: WebSocketConnectionOptions;
  private websocket?: BaleWebSocketConnection;
  private session?: SessionState;
  private running = false;
  private stopPromise?: Promise<void>;
  private stopResolver?: () => void;
  private shutdownDispatched = false;
  private readonly peerCache = new Map<string, User | Chat>();
  private readonly inflightPeerLoads = new Map<string, Promise<User | Chat | undefined>>();
  private readonly inflightChatSearches = new Map<string, Promise<User | Chat | undefined>>();
  private readonly messageChatCache = new Map<string, Chat>();
  private readonly messageAuthorCache = new Map<number, User>();
  private walletCache?: CachedWalletState;
  private walletCachePromise?: Promise<WalletResponse>;
  user?: User;

  constructor(tokenOrPhoneNumber: string, options: ClientOptions = {}) {
    this.token_or_phone_number = tokenOrPhoneNumber;
    this.sessionDir = options.sessionDir ?? process.cwd();
    this.grpcConnection = new BaleGrpcConnection(options.grpc);
    this.websocketOptions = options.websocket ?? {};

    if (isSessionString(tokenOrPhoneNumber)) {
      this.session = parseSessionString(tokenOrPhoneNumber);
    }
  }

  on_message(condition?: Condition<Message>): (callback: MessageCallback) => MessageCallback;
  on_message(callback: MessageCallback): MessageCallback;
  on_message(
    conditionOrCallback?: Condition<Message> | MessageCallback,
  ): MessageCallback | ((callback: MessageCallback) => MessageCallback) {
    if (typeof conditionOrCallback === "function") {
      return this.dispatcher.addMessageHandler(conditionOrCallback);
    }

    return (callback: MessageCallback) => this.dispatcher.addMessageHandler(callback, conditionOrCallback);
  }

  on_command(
    name: string,
    condition?: Condition<Message>,
  ): (callback: MessageCallback) => MessageCallback {
    return (callback: MessageCallback) => {
      const commandCondition = command(name);
      const finalCondition = condition ? commandCondition.and(condition) : commandCondition;
      return this.dispatcher.addMessageHandler(callback, finalCondition);
    };
  }

  on_error(callback: ErrorCallback): ErrorCallback {
    return this.dispatcher.addErrorHandler(callback);
  }

  on_connect(callback: LifecycleCallback): LifecycleCallback {
    return this.dispatcher.addLifecycleHandler("connect", callback);
  }

  on_disconnect(callback: LifecycleCallback): LifecycleCallback {
    return this.dispatcher.addLifecycleHandler("disconnect", callback);
  }

  on_initialize(callback: LifecycleCallback): LifecycleCallback {
    return this.dispatcher.addLifecycleHandler("initialize", callback);
  }

  on_shutdown(callback: LifecycleCallback): LifecycleCallback {
    return this.dispatcher.addLifecycleHandler("shutdown", callback);
  }

  async connect(): Promise<void> {
    if (!this.session) {
      this.session = await this.load_session();
    }

    if (!this.session) {
      this.session = await this.authenticate();
      await this.save_session(this.session);
    }

    this.websocket = new BaleWebSocketConnection(this.session.jwt, this.websocketOptions);
    this.websocket.on("update", (update) => {
      void this.handleUpdate(update as Record<string, unknown>);
    });
    this.websocket.on("close", () => {
      void this.handleDisconnect();
    });
    this.websocket.on("error", (error) => {
      void this.dispatcher.dispatchError(this, error);
    });

    await this.websocket.start();
    this.user = await this.get_me();
  }

  async disconnect(): Promise<void> {
    if (this.websocket) {
      await this.websocket.stop();
      this.websocket = undefined;
    }

    this.grpcConnection.close();
  }

  run(task?: (client: Client) => unknown | Promise<unknown>): Promise<void> {
    return (async () => {
      const sigintHandler = () => {
        void this.stop();
      };

      process.once("SIGINT", sigintHandler);

      try {
        await this.connect();
        this.running = true;
        this.shutdownDispatched = false;
        this.stopPromise = new Promise<void>((resolve) => {
          this.stopResolver = resolve;
        });

        await this.dispatcher.dispatchLifecycle("connect", this);
        await this.dispatcher.dispatchLifecycle("initialize", this);

        if (task) {
          await task(this);
          await this.stop();
        } else if (this.stopPromise) {
          await this.stopPromise;
        }
      } catch (error) {
        await this.dispatcher.dispatchError(this, error);
      } finally {
        process.removeListener("SIGINT", sigintHandler);
        await this.stop();
      }
    })();
  }

  async stop(): Promise<void> {
    if (!this.running && !this.websocket) {
      return;
    }

    this.running = false;

    if (!this.shutdownDispatched) {
      this.shutdownDispatched = true;
      await this.dispatcher.dispatchLifecycle("shutdown", this);
    }

    await this.disconnect();

    if (this.stopResolver) {
      this.stopResolver();
      this.stopResolver = undefined;
    }
  }

  async start_phone_auth(phoneNumber: string): Promise<Record<string, any>> {
    return await this.grpcConnection.request<Record<string, any>>(
      "bale.auth.v1.Auth",
      "StartPhoneAuth",
      "request.StartPhoneAuth",
      "response.StartPhoneAuth",
      {
        phone_number: normalizeAuthPhoneNumber(phoneNumber),
        app_id: 4,
        api_key: "C28D46DC4C3A7A26564BFCC48B929086A95C93C98E789A19847BEE8627DE4E7D",
        device_hash: "ce5ced83-a9ab-47fa-80c8-ed425eeb2ace",
        device_title: "Chrome_138.0.0.0, Windows",
        send_code_type: 1,
        options: START_PHONE_AUTH_OPTIONS,
      },
    );
  }

  async validate_code(transactionHash: string, code: string): Promise<Record<string, any>> {
    return await this.grpcConnection.request<Record<string, any>>(
      "bale.auth.v1.Auth",
      "ValidateCode",
      "request.ValidateCode",
      "response.Auth",
      {
        transaction_hash: transactionHash,
        code,
        is_jwt: {
          value: true,
        },
      },
    );
  }

  async validate_password(transactionHash: string, password: string): Promise<Record<string, any>> {
    return await this.grpcConnection.request<Record<string, any>>(
      "bale.auth.v1.Auth",
      "ValidatePassword",
      "request.ValidatePassword",
      "response.Auth",
      {
        transaction_hash: transactionHash,
        password,
        is_jwt: {
          value: true,
        },
      },
    );
  }

  async sign_up(transactionHash: string, name: string, password?: string): Promise<Record<string, any>> {
    return await this.grpcConnection.request<Record<string, any>>(
      "bale.auth.v1.Auth",
      "SignUp",
      "request.SignUp",
      "response.Auth",
      {
        transaction_hash: transactionHash,
        name,
        password: password ? { value: password } : undefined,
      },
    );
  }

  async sign_out(): Promise<DefaultResponse> {
    const response = await this.post<Record<string, any>>(
      "bale.auth.v1.Auth",
      "SignOut",
      "request.SignOut",
      "response.DefaultResponse",
      {},
    );

    this.session = undefined;
    this.user = undefined;
    this.walletCache = undefined;
    this.walletCachePromise = undefined;
    this.peerCache.clear();
    this.inflightPeerLoads.clear();
    this.inflightChatSearches.clear();
    this.messageChatCache.clear();
    this.messageAuthorCache.clear();

    try {
      await unlink(this.getSessionPath());
    } catch {
      // Ignore missing session files after sign-out.
    }

    return wrapDefaultResponse(response);
  }

  async edit_name(name: string): Promise<DefaultResponse> {
    const response = await this.invoke<Record<string, any>>(
      "bale.users.v1.Users",
      "EditName",
      "request.EditName",
      "response.DefaultResponse",
      {
        name,
      },
    );

    return wrapDefaultResponse(response);
  }

  async edit_nickname(nickname?: string): Promise<DefaultResponse> {
    const response = await this.invoke<Record<string, any>>(
      "bale.users.v1.Users",
      "EditNickName",
      "request.EditNickName",
      "response.DefaultResponse",
      {
        nick_name: nickname ? { value: nickname } : undefined,
      },
    );

    return wrapDefaultResponse(response);
  }

  async edit_about(about?: string): Promise<DefaultResponse> {
    const response = await this.invoke<Record<string, any>>(
      "bale.users.v1.Users",
      "EditAbout",
      "request.EditAbout",
      "response.DefaultResponse",
      {
        about: about ? { value: about } : undefined,
      },
    );

    return wrapDefaultResponse(response);
  }

  async check_nickname(nickname: string): Promise<boolean> {
    const response = await this.invoke<Record<string, any>>(
      "bale.users.v1.Users",
      "CheckNickName",
      "request.CheckNickName",
      "response.CheckNickName",
      {
        nick_name: nickname,
      },
    );

    return Boolean(response.available);
  }

  async get_me(): Promise<User> {
    const session = this.session ?? (await this.load_session());
    if (!session) {
      throw new AuthenticationError("No Bale session is available");
    }

    const me = await this.get_chat(`${session.userId}|1`);
    if (!(me instanceof User)) {
      throw new ClientStateError("Could not load Bale user profile");
    }

    me.bind(this);
    return me;
  }

  async get_chat(chatId: string): Promise<User | Chat | undefined> {
    const cachedPeer = this.peerCache.get(chatId);
    if (cachedPeer) {
      return cachedPeer;
    }

    const parsed = parsePeerString(chatId);
    if (parsed) {
      return await this.loadPeer(parsed.id, parsed.type);
    }

    const normalizedQuery = normalizeSearchQuery(chatId);
    const inflightSearch = this.inflightChatSearches.get(normalizedQuery);
    if (inflightSearch) {
      return await inflightSearch;
    }

    const searchPromise = this.searchChat(normalizedQuery);
    this.inflightChatSearches.set(normalizedQuery, searchPromise);

    try {
      return await searchPromise;
    } finally {
      this.inflightChatSearches.delete(normalizedQuery);
    }
  }

  async load_users(users: Array<number | string>): Promise<User[]> {
    const response = await this.invoke<Record<string, any>>(
      "bale.users.v1.Users",
      "LoadUsers",
      "request.LoadUsers",
      "response.LoadUsers",
      {
        user_peers: users.map((user) => this.requireUserOutPeer(user)),
      },
    );

    return Array.isArray(response.users)
      ? response.users.map((raw) => {
          const wrapped = wrapUser(raw);
          wrapped.bind(this);
          this.peerCache.set(`${wrapped.id}|1`, wrapped);
          if (wrapped.isBot) {
            this.peerCache.set(`${wrapped.id}|4`, wrapped);
          }
          return wrapped;
        })
      : [];
  }

  async load_full_users(users: Array<number | string>): Promise<Array<Record<string, any>>> {
    const response = await this.invoke<Record<string, any>>(
      "bale.users.v1.Users",
      "LoadFullUsers",
      "request.LoadFullUsers",
      "response.LoadFullUsers",
      {
        user_peers: users.map((user) => this.requireUserOutPeer(user)),
      },
    );

    return Array.isArray(response.full_users) ? response.full_users : [];
  }

  async get_full_group(chatId: string): Promise<Record<string, any> | undefined> {
    const groupPeer = this.requireGroupPeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.groups.v1.Groups",
      "GetFullGroup",
      "request.GetFullGroup",
      "response.GetFullGroup",
      {
        peer: groupPeer,
      },
    );

    return response.full_group;
  }

  private async searchChat(normalizedQuery: string): Promise<User | Chat | undefined> {
    const response = await this.invoke<Record<string, any>>(
      "bale.users.v1.Users",
      "SearchContacts",
      "request.SearchContacts",
      "response.SearchContacts",
      {
        request: normalizedQuery,
      },
    );

    if (response.user_peers?.length) {
      return await this.loadPeer(Number(response.user_peers[0].uid), 1);
    }

    if (response.group_peers?.length) {
      return await this.loadPeer(Number(response.group_peers[0].group_id), 2);
    }

    return undefined;
  }

  async search_contacts(query: string): Promise<Record<string, any>> {
    const response = await this.invoke<Record<string, any>>(
      "bale.users.v1.Users",
      "SearchContacts",
      "request.SearchContacts",
      "response.SearchContacts",
      {
        request: normalizeSearchQuery(query),
      },
    );

    const wrappedUsers = Array.isArray(response.users)
      ? response.users.map((raw) => {
          const user = wrapUser(raw);
          user.bind(this);
          this.peerCache.set(`${user.id}|1`, user);
          if (user.isBot) {
            this.peerCache.set(`${user.id}|4`, user);
          }
          return user;
        })
      : [];
    const wrappedGroups = Array.isArray(response.groups)
      ? response.groups.map((raw) => {
          const chat = wrapGroup(raw);
          chat.bind(this);
          this.peerCache.set(chat.id, chat);
          return chat;
        })
      : [];

    return {
      ...response,
      users: wrappedUsers,
      groups: wrappedGroups,
    };
  }

  async load_history(chatId: string, fromDate = -1, limit = 20): Promise<Message[]> {
    const peer = this.requirePeer(chatId);
    const history = await this.loadHistory(peer, fromDate, limit);
    const messages = Array.isArray(history.history) ? history.history : [];

    return messages
      .map((item) => {
        return this.wrapIncomingMessage({
          peer,
          sender_uid: item.sender_uid,
          date: item.date,
          rid: item.rid,
          message: item.message,
        });
      })
      .filter((message) => Number(message.rid) !== 0);
  }

  async clear_chat(chatId: string): Promise<DefaultResponse> {
    const peer = this.requirePeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.messaging.v2.Messaging",
      "ClearChat",
      "request.ClearChat",
      "response.DefaultResponse",
      {
        peer,
      },
    );

    return wrapDefaultResponse(response);
  }

  async message_read(chatId: string, date = Date.now()): Promise<DefaultResponse> {
    const peer = this.requirePeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.messaging.v2.Messaging",
      "MessageRead",
      "request.MessageRead",
      "response.DefaultResponse",
      {
        peer,
        date,
      },
    );

    return wrapDefaultResponse(response);
  }

  async load_dialogs(limit = 40, minDate = -1, excludePinned = false): Promise<Record<string, any>> {
    return await this.invoke<Record<string, any>>(
      "bale.messaging.v2.Messaging",
      "LoadDialogs",
      "request.LoadDialogs",
      "response.LoadDialogs",
      {
        min_date: minDate,
        limit,
        exclude_pinned_dialogs: excludePinned,
      },
    );
  }

  async set_online(isOnline: boolean, duration: number): Promise<DefaultResponse> {
    const response = await this.invoke<Record<string, any>>(
      "bale.presence.v1.Presence",
      "SetOnline",
      "request.SetOnline",
      "response.DefaultResponse",
      {
        is_online: isOnline ? 1 : 0,
        duration,
      },
    );

    return wrapDefaultResponse(response);
  }

  async typing(chatId: string, typingType = 1): Promise<DefaultResponse> {
    return await this.start_typing(chatId, typingType);
  }

  async start_typing(chatId: string, typingType = 1): Promise<DefaultResponse> {
    const peer = this.requireOutPeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.presence.v1.Presence",
      "Typing",
      "request.Typing",
      "response.DefaultResponse",
      {
        peer,
        typing_type: typingType,
      },
    );

    return wrapDefaultResponse(response);
  }

  async stop_typing(chatId: string, typingType = 1): Promise<DefaultResponse> {
    const peer = this.requirePeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.presence.v1.Presence",
      "StopTyping",
      "request.StopTyping",
      "response.DefaultResponse",
      {
        peer,
        typing_type: typingType,
      },
    );

    return wrapDefaultResponse(response);
  }

  async get_parameters(): Promise<Array<{ key: string; value: string }>> {
    const response = await this.invoke<Record<string, any>>(
      "bale.v1.Configs",
      "GetParameters",
      "request.GetParameters",
      "response.GetParameters",
      {},
    );

    const items = Array.isArray(response.params) ? response.params : [];
    return items.map((item) => ({
      key: String(item.key ?? ""),
      value: String(item.value ?? ""),
    }));
  }

  async edit_parameter(key: string, value?: string): Promise<DefaultResponse> {
    const response = await this.invoke<Record<string, any>>(
      "bale.v1.Configs",
      "EditParameter",
      "request.EditParameter",
      "response.DefaultResponse",
      {
        key,
        value: value !== undefined ? { value } : undefined,
      },
    );

    return wrapDefaultResponse(response);
  }

  async join_chat(tokenOrUrl: string): Promise<Chat> {
    const response = await this.invoke<Record<string, any>>(
      "bale.groups.v1.Groups",
      "JoinGroup",
      "request.JoinGroup",
      "response.JoinGroup",
      {
        token: extractJoinToken(tokenOrUrl),
        optimizations: EMPTY_OPTIMIZATIONS,
      },
    );

    const chat = wrapGroup(response.group);
    chat.bind(this);
    this.peerCache.set(`${chat.peerId}|${chat.peerType}`, chat);
    return chat;
  }

  async join_group(tokenOrUrl: string): Promise<Chat> {
    return await this.join_chat(tokenOrUrl);
  }

  async join_public_chat(chatId: string): Promise<Chat> {
    const peer = this.requirePeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.groups.v1.Groups",
      "JoinPublicGroup",
      "request.JoinPublicGroup",
      "response.JoinPublicGroup",
      {
        peer,
        optimizations: EMPTY_OPTIMIZATIONS,
      },
    );

    const chat = wrapGroup(response.group);
    chat.bind(this);
    this.peerCache.set(`${chat.peerId}|${chat.peerType}`, chat);
    return chat;
  }

  async join_public_group(chatId: string): Promise<Chat> {
    return await this.join_public_chat(chatId);
  }

  async leave_chat(chatId: string): Promise<DefaultResponse> {
    const groupPeer = this.requireGroupPeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.groups.v1.Groups",
      "LeaveGroup",
      "request.LeaveGroup",
      "response.DefaultResponse",
      {
        group_peer: groupPeer,
        rid: BaleWebSocketConnection.createRid(),
        optimizations: EMPTY_OPTIMIZATIONS,
        make_orphan: false,
      },
    );

    return wrapDefaultResponse(response);
  }

  async leave_group(chatId: string): Promise<DefaultResponse> {
    return await this.leave_chat(chatId);
  }

  async get_group_link(chatId: string): Promise<string | undefined> {
    const groupPeer = this.requireGroupPeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.groups.v1.Groups",
      "GetGroupInviteURL",
      "request.GetGroupInviteUrl",
      "response.GetGroupInviteUrl",
      {
        group_peer: groupPeer,
      },
    );

    return response.url;
  }

  async get_group_invite_url(chatId: string): Promise<string | undefined> {
    return await this.get_group_link(chatId);
  }

  async revoke_group_link(chatId: string): Promise<string | undefined> {
    const groupPeer = this.requireGroupPeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.groups.v1.Groups",
      "RevokeInviteURL",
      "request.RevokeInviteUrl",
      "response.RevokeInviteUrl",
      {
        group_peer: groupPeer,
      },
    );

    return response.url;
  }

  async revoke_invite_url(chatId: string): Promise<string | undefined> {
    return await this.revoke_group_link(chatId);
  }

  async invite_users(chatId: string, userIds: number[]): Promise<Record<string, any>> {
    const groupPeer = this.requireGroupPeer(chatId);
    return await this.invoke<Record<string, any>>(
      "bale.groups.v1.Groups",
      "InviteUsers",
      "request.InviteUsers",
      "response.InviteUsers",
      {
        group_peer: groupPeer,
        rid: BaleWebSocketConnection.createRid(),
        users: userIds.map((id) => ({
          uid: id,
          access_hash: 1,
        })),
      },
    );
  }

  async kick_user(chatId: string, userId: number): Promise<DefaultResponse> {
    const groupPeer = this.requireGroupPeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.groups.v1.Groups",
      "KickUser",
      "request.KickUser",
      "response.DefaultResponse",
      {
        group_peer: groupPeer,
        user: this.requireUserOutPeer(userId),
        rid: BaleWebSocketConnection.createRid(),
        optimizations: EMPTY_OPTIMIZATIONS,
      },
    );

    return wrapDefaultResponse(response);
  }

  async remove_user_admin(chatId: string, userId: number): Promise<DefaultResponse> {
    const groupPeer = this.requireGroupPeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.groups.v1.Groups",
      "RemoveUserAdmin",
      "request.RemoveUserAdmin",
      "response.DefaultResponse",
      {
        group_peer: groupPeer,
        user_peer: this.requireUserOutPeer(userId),
      },
    );

    return wrapDefaultResponse(response);
  }

  async set_member_permissions(
    chatId: string,
    userId: number,
    permissions: Record<string, boolean>,
  ): Promise<DefaultResponse> {
    const groupPeer = this.requireGroupPeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.groups.v1.Groups",
      "SetMemberPermissions",
      "request.SetMemberPermissions",
      "response.DefaultResponse",
      {
        group: groupPeer,
        user: this.requireUserOutPeer(userId),
        permissions,
      },
    );

    return wrapDefaultResponse(response);
  }

  async unban_user(chatId: string, userId: number): Promise<DefaultResponse> {
    const groupPeer = this.requireGroupPeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.groups.v1.Groups",
      "UnBanUser",
      "request.UnBanUser",
      "response.DefaultResponse",
      {
        group_peer: groupPeer,
        user: this.requireUserOutPeer(userId),
        optimizations: EMPTY_OPTIMIZATIONS,
      },
    );

    return wrapDefaultResponse(response);
  }

  async edit_group_title(chatId: string, title: string): Promise<DefaultResponse> {
    const groupPeer = this.requireGroupPeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.groups.v1.Groups",
      "EditGroupTitle",
      "request.EditGroupTitle",
      "response.DefaultResponse",
      {
        group_peer: groupPeer,
        title,
        rid: BaleWebSocketConnection.createRid(),
        optimizations: EMPTY_OPTIMIZATIONS,
      },
    );

    return wrapDefaultResponse(response);
  }

  async edit_group_about(chatId: string, about: string): Promise<DefaultResponse> {
    const groupPeer = this.requireGroupPeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.groups.v1.Groups",
      "EditGroupAbout",
      "request.EditGroupAbout",
      "response.DefaultResponse",
      {
        group_peer: groupPeer,
        rid: BaleWebSocketConnection.createRid(),
        about,
        optimizations: EMPTY_OPTIMIZATIONS,
      },
    );

    return wrapDefaultResponse(response);
  }

  async edit_group_avatar(chatId: string, file: FileLocationInput): Promise<Record<string, any>> {
    const groupPeer = this.requireGroupPeer(chatId);
    return await this.invoke<Record<string, any>>(
      "bale.groups.v1.Groups",
      "EditGroupAvatar",
      "request.EditGroupAvatar",
      "response.EditGroupAvatar",
      {
        group_peer: groupPeer,
        file_location: {
          file_id: file.file_id,
          access_hash: file.access_hash,
          file_storage_version:
            file.file_storage_version !== undefined
              ? {
                  value: file.file_storage_version,
                }
              : undefined,
        },
        rid: BaleWebSocketConnection.createRid(),
        optimizations: EMPTY_OPTIMIZATIONS,
      },
    );
  }

  async load_group_avatars(chatId: string): Promise<Record<string, any>[]> {
    const peer = this.requireGroupPeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.groups.v1.Groups",
      "LoadGroupAvatars",
      "request.LoadGroupAvatars",
      "response.LoadGroupAvatars",
      {
        peer,
      },
    );

    const avatars = response.avatars as Record<string, any> | undefined;
    return Array.isArray(avatars?.avatars) ? avatars.avatars : [];
  }

  async remove_group_avatar(chatId: string, avatarId?: number): Promise<DefaultResponse> {
    const groupPeer = this.requireGroupPeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.groups.v1.Groups",
      "RemoveGroupAvatar",
      "request.RemoveGroupAvatar",
      "response.DefaultResponse",
      {
        group_peer: groupPeer,
        rid: BaleWebSocketConnection.createRid(),
        optimizations: EMPTY_OPTIMIZATIONS,
        avatar_id: avatarId !== undefined ? { value: avatarId } : undefined,
      },
    );

    return wrapDefaultResponse(response);
  }

  async load_members(chatId: string, limit = 50, next?: string | number): Promise<Record<string, any>> {
    const groupPeer = this.requireGroupPeer(chatId);
    return await this.invoke<Record<string, any>>(
      "bale.groups.v1.Groups",
      "LoadMembers",
      "request.LoadMembers",
      "response.LoadMembers",
      {
        group: groupPeer,
        limit,
        next: next !== undefined ? { value: String(next) } : undefined,
      },
    );
  }

  async get_group_members_count(chatId: string): Promise<number> {
    const groupPeer = this.requireGroupPeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.groups.v1.Groups",
      "GetGroupMembersCount",
      "request.GetGroupMembersCount",
      "response.GetGroupMembersCount",
      {
        group: groupPeer,
      },
    );

    return Number(response.members_count ?? 0);
  }

  async load_pinned_messages(chatId: string): Promise<Message[]> {
    const peer = this.requireExPeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.messaging.v2.Messaging",
      "LoadPinnedMessages",
      "request.LoadPinnedMessages",
      "response.LoadPinnedMessages",
      {
        peer,
      },
    );

    const items = Array.isArray(response.pinned_messages) ? response.pinned_messages : [];
    return items.map((item) => {
      return this.wrapIncomingMessage({
        peer: peer,
        sender_uid: item.sender_uid,
        date: item.date,
        rid: item.rid,
        message: item.message,
      });
    });
  }

  async pin_message(chatId: string, messageId: string, justMine = false): Promise<DefaultResponse> {
    const peer = this.requirePeer(chatId);
    const parsedMessageId = parseMessageId(messageId);
    const response = await this.invoke<Record<string, any>>(
      "bale.messaging.v2.Messaging",
      "PinMessage",
      "request.PinMessages",
      "response.DefaultResponse",
      {
        peer,
        message_id: {
          rid: parsedMessageId.rid,
          date: parsedMessageId.date,
        },
        just_mine: justMine,
      },
    );

    return wrapDefaultResponse(response);
  }

  async unpin_messages(chatId: string, messageIds: string[] = [], all = false): Promise<DefaultResponse> {
    const peer = this.requireExPeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.messaging.v2.Messaging",
      "UnPinMessages",
      "request.UnPinMessages",
      "response.DefaultResponse",
      {
        peer,
        message_ids: messageIds.map((messageId) => {
          const parsedMessageId = parseMessageId(messageId);
          return {
            rid: parsedMessageId.rid,
            date: parsedMessageId.date,
          };
        }),
        all,
      },
    );

    return wrapDefaultResponse(response);
  }

  async pin_group_message(chatId: string, messageId: string): Promise<DefaultResponse> {
    const groupPeer = this.requireGroupPeer(chatId);
    const parsedMessageId = parseMessageId(messageId);
    const response = await this.invoke<Record<string, any>>(
      "bale.groups.v1.Groups",
      "PinMessage",
      "request.PinMessage",
      "response.DefaultResponse",
      {
        group_peer: groupPeer,
        date: parsedMessageId.date,
        msg_rid: parsedMessageId.rid,
      },
    );

    return wrapDefaultResponse(response);
  }

  async unpin_group_message(chatId: string, messageId: string): Promise<DefaultResponse> {
    const groupPeer = this.requireGroupPeer(chatId);
    const parsedMessageId = parseMessageId(messageId);
    const response = await this.invoke<Record<string, any>>(
      "bale.groups.v1.Groups",
      "RemoveSinglePin",
      "request.RemoveSinglePin",
      "response.DefaultResponse",
      {
        group_peer: groupPeer,
        rid: parsedMessageId.rid,
        date: parsedMessageId.date,
      },
    );

    return wrapDefaultResponse(response);
  }

  async remove_single_pin(chatId: string, messageId: string): Promise<DefaultResponse> {
    return await this.unpin_group_message(chatId, messageId);
  }

  async remove_group_pins(chatId: string): Promise<DefaultResponse> {
    const groupPeer = this.requireGroupPeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.groups.v1.Groups",
      "RemovePin",
      "request.RemovePin",
      "response.DefaultResponse",
      {
        group_peer: groupPeer,
      },
    );

    return wrapDefaultResponse(response);
  }

  async remove_all_pins(chatId: string): Promise<DefaultResponse> {
    return await this.remove_group_pins(chatId);
  }

  async get_file(fileId: number, accessHash: number): Promise<Record<string, any>> {
    return await this.invoke<Record<string, any>>(
      "ai.bale.server.Files",
      "GetNasimFileUrl",
      "request.GetNasimFileUrl",
      "response.GetNasimFileUrl",
      {
        file: {
          file_id: fileId,
          access_hash: accessHash,
        },
      },
    );
  }

  async get_file_url(fileId: number, accessHash: number): Promise<Record<string, any>> {
    return await this.get_file(fileId, accessHash);
  }

  async get_file_upload_url(
    expectedSize: number,
    crc = 0,
    uid = this.user?.id ?? this.session?.userId ?? 0,
    name: string,
    mimeType: string,
    exPeer?: string,
    sendType?: number,
    chunkSize?: number,
  ): Promise<Record<string, any>> {
    return await this.invoke<Record<string, any>>(
      "ai.bale.server.Files",
      "GetNasimFileUploadUrl",
      "request.GetNasimFileUploadUrl",
      "response.GetNasimFileUploadUrl",
      {
        expected_size: expectedSize,
        crc,
        uid,
        name,
        mime_type: mimeType,
        ex_peer: exPeer ? this.requireExPeer(exPeer) : undefined,
        send_type: sendType !== undefined ? { type: sendType } : undefined,
        chunk_size: chunkSize,
      },
    );
  }

  async send_message(chatId: string, text: string): Promise<Message> {
    const peer = this.requirePeer(chatId);
    const rid = BaleWebSocketConnection.createRid();
    const messagePayload = {
      text_message: {
        text,
      },
    };
    const response = await this.invoke<Record<string, any>>(
      "bale.messaging.v2.Messaging",
      "SendMessage",
      "request.SendMessage",
      "response.DefaultResponse",
      {
        peer,
        rid,
        message: messagePayload,
        ex_peer: peer,
      },
    );

    return this.createOutboundMessage(peer, rid, response.date, messagePayload);
  }

  async send_multi_media_message(chatId: string, media: SingleMediaInput[]): Promise<Message[]> {
    const peer = this.requirePeer(chatId);
    const exPeer = this.requireExPeer(chatId);
    const groupedId = BaleWebSocketConnection.createRid();
    const normalizedMedia = media.map((item) => {
      const randomId = item.random_id ?? BaleWebSocketConnection.createRid();
      return {
        random_id: randomId,
        media: item.media,
      };
    });
    const response = await this.invoke<Record<string, any>>(
      "bale.messaging.v2.Messaging",
      "SendMultiMediaMessage",
      "request.SendMultiMediaMessage",
      "response.DefaultResponse",
      {
        peer: exPeer,
        multi_media: normalizedMedia,
        grouped_id: groupedId,
      },
    );

    return normalizedMedia.map((item) =>
      this.createOutboundMessage(peer, item.random_id, response.date, {
        document_message: item.media,
      }),
    );
  }

  async get_messages_views(
    chatId: string,
    messageIds: Array<string | Message | OtherMessage>,
    increment = false,
  ): Promise<Record<string, any>> {
    const peer = this.requirePeer(chatId);
    return await this.invoke<Record<string, any>>(
      "bale.abacus.v1.Abacus",
      "GetMessagesViews",
      "request.GetMessageViews",
      "response.GetMessageViews",
      {
        peer,
        mids: messageIds.map((message) => this.toMessageIdentifier(message)),
        increment,
      },
    );
  }

  async message_set_reaction(chatId: string, messageId: string, code: string): Promise<Record<string, any>> {
    const peer = this.requirePeer(chatId);
    const parsedMessageId = parseMessageId(messageId);
    return await this.invoke<Record<string, any>>(
      "bale.abacus.v1.Abacus",
      "MessageSetReaction",
      "request.MessageSetReaction",
      "response.MessageSetReaction",
      {
        peer,
        rid: parsedMessageId.rid,
        code,
        date: parsedMessageId.date,
      },
    );
  }

  async delete_message(chatId: string, messageId: string): Promise<DefaultResponse> {
    const peer = this.requirePeer(chatId);
    const parsedMessageId = parseMessageId(messageId);

    const response = await this.invoke<Record<string, any>>(
      "bale.messaging.v2.Messaging",
      "DeleteMessage",
      "request.DeleteMessage",
      "response.DefaultResponse",
      {
        peer,
        rids: [parsedMessageId.rid],
        dates: {
          dates: [parsedMessageId.date],
        },
        just_mine: {
          value: 0,
        },
      },
    );

    return wrapDefaultResponse(response);
  }

  async edit_message_text(chatId: string, messageId: string, text: string): Promise<DefaultResponse> {
    const peer = this.requirePeer(chatId);
    const parsedMessageId = parseMessageId(messageId);
    const currentMessage = await this.findHistoryMessage(peer, parsedMessageId);

    if (!currentMessage?.message?.text_message) {
      throw new ClientStateError(`Could not load text message ${messageId} from ${chatId}`);
    }

    currentMessage.message.text_message.text = text;
    const response = await this.invoke<Record<string, any>>(
      "bale.messaging.v2.Messaging",
      "UpdateMessage",
      "request.UpdateMessage",
      "response.DefaultResponse",
      {
        peer,
        rid: parsedMessageId.rid,
        updated_message: currentMessage.message,
      },
    );

    return wrapDefaultResponse(response);
  }

  async forward_message(chatId: string, fromChatId: string, messageId: string): Promise<DefaultResponse> {
    const peer = this.requirePeer(chatId);
    const sourcePeer = this.requirePeer(fromChatId);
    const parsedMessageId = parseMessageId(messageId);

    const response = await this.invoke<Record<string, any>>(
      "bale.messaging.v2.Messaging",
      "ForwardMessages",
      "request.ForwardMessages",
      "response.DefaultResponse",
      {
        peer,
        rid: [BaleWebSocketConnection.createRid()],
        forwarded_messages: [
          {
            peer: sourcePeer,
            random_id: parsedMessageId.rid,
            date: {
              value: parsedMessageId.date,
            },
          },
        ],
      },
    );

    return wrapDefaultResponse(response);
  }

  async copy_message(chatId: string, fromChatId: string, messageId: string): Promise<Message> {
    const peer = this.requirePeer(chatId);
    const sourcePeer = this.requirePeer(fromChatId);
    const parsedMessageId = parseMessageId(messageId);
    const sourceMessage = await this.findHistoryMessage(sourcePeer, parsedMessageId);

    if (!sourceMessage?.message) {
      throw new ClientStateError(`Could not load source message ${messageId} from ${fromChatId}`);
    }

    const rid = BaleWebSocketConnection.createRid();
    const response = await this.invoke<Record<string, any>>(
      "bale.messaging.v2.Messaging",
      "SendMessage",
      "request.SendMessage",
      "response.DefaultResponse",
      {
        peer,
        rid,
        message: sourceMessage.message,
        ex_peer: peer,
      },
    );

    return this.createOutboundMessage(peer, rid, response.date, sourceMessage.message);
  }

  async get_wallet(): Promise<WalletResponse> {
    if (this.walletCache && this.walletCache.expiresAt > Date.now()) {
      return this.walletCache.value;
    }

    if (this.walletCachePromise) {
      return await this.walletCachePromise;
    }

    this.walletCachePromise = (async () => {
      const response = await this.invoke<Record<string, any>>(
        "bale.kifpool.v1.Kifpool",
        "GetMyKifpools",
        "request.GetMyKifpools",
        "response.GetMyKifpools",
        {},
      );

      const walletResponse = wrapWalletResponse(response);
      this.walletCache = {
        value: walletResponse,
        expiresAt: Date.now() + 60_000,
      };
      return walletResponse;
    })();

    try {
      return await this.walletCachePromise;
    } finally {
      this.walletCachePromise = undefined;
    }
  }

  async get_my_kifpools(): Promise<WalletResponse> {
    return await this.get_wallet();
  }

  async send_gift(
    chatId: string,
    amount: number,
    message: string,
    options: {
      gift_count?: number;
      giving_type?: GivingType;
      show_amounts?: boolean;
      token?: string;
    } = {},
  ): Promise<DefaultResponse> {
    const peer = this.requirePeer(chatId);
    const walletToken = options.token ?? (await this.get_wallet()).wallet?.token;

    if (!walletToken) {
      throw new ClientStateError("A wallet token is required to send a gift");
    }

    const response = await this.invoke<Record<string, any>>(
      "bale.giftpacket.v1.GiftPacket",
      "SendGiftPacketWithWallet",
      "request.SendGiftPacketWithWallet",
      "response.DefaultResponse",
      {
        peer,
        random_id: BaleWebSocketConnection.createRid(),
        gift: {
          count: options.gift_count ?? 1,
          total_amount: amount,
          giving_type: options.giving_type ?? GivingType.SAME,
          message: {
            value: message,
          },
          owner_id: this.user?.id,
          show_amounts: {
            value: options.show_amounts ?? true,
          },
        },
        token: walletToken,
      },
    );

    return wrapDefaultResponse(response);
  }

  async send_gift_packet_with_wallet(
    chatId: string,
    amount: number,
    message: string,
    options: {
      gift_count?: number;
      giving_type?: GivingType;
      show_amounts?: boolean;
      token?: string;
    } = {},
  ): Promise<DefaultResponse> {
    return await this.send_gift(chatId, amount, message, options);
  }

  async send_giftpacket(
    chatId: string,
    amount: number,
    message: string,
    options: {
      gift_count?: number;
      giving_type?: GivingType;
      show_amounts?: boolean;
      token?: string;
    } = {},
  ): Promise<DefaultResponse> {
    return await this.send_gift(chatId, amount, message, options);
  }

  async open_gift(message: Message, receiverToken?: string): Promise<PacketResponse> {
    const walletToken = receiverToken ?? (await this.get_wallet()).wallet?.token;

    if (!walletToken) {
      throw new ClientStateError("A wallet token is required to open a gift");
    }

    const response = await this.invoke<Record<string, any>>(
      "bale.giftpacket.v1.GiftPacket",
      "OpenGiftPacket",
      "request.OpenGiftPacket",
      "response.OpenGiftPacket",
      {
        message: this.ensureInfoMessage(message),
        receiver_token: walletToken,
      },
    );

    return wrapPacketResponse(response);
  }

  async open_gift_packet(message: Message, receiverToken?: string): Promise<PacketResponse> {
    return await this.open_gift(message, receiverToken);
  }

  async open_packet(message: Message, receiverToken?: string): Promise<PacketResponse> {
    return await this.open_gift(message, receiverToken);
  }

  async report_chat(
    chatId: string,
    reason?: string,
    kind: ReportKind = ReportKind.SPAM,
    source: PeerSource = PeerSource.DIALOGS,
  ): Promise<DefaultResponse> {
    const peer = this.requirePeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.report.v1.Report",
      "ReportInappropriateContent",
      "request.ReportInappropriateContent",
      "response.DefaultResponse",
      {
        report_body: {
          kind,
          description: reason,
          peer_report: {
            source,
            peer,
          },
        },
      },
    );

    return wrapDefaultResponse(response);
  }

  async report_messages(
    chatId: string,
    messages: Array<Message | OtherMessage>,
    reason?: string,
    kind: ReportKind = ReportKind.SPAM,
  ): Promise<DefaultResponse> {
    const peer = this.requirePeer(chatId);
    const response = await this.invoke<Record<string, any>>(
      "bale.report.v1.Report",
      "ReportInappropriateContent",
      "request.ReportInappropriateContent",
      "response.DefaultResponse",
      {
        report_body: {
          kind,
          description: reason,
          message_report: {
            peer,
            messages: messages.map((message) => this.ensureOtherMessage(message)),
          },
        },
      },
    );

    return wrapDefaultResponse(response);
  }

  async report_message(
    chatId: string,
    message: Message | OtherMessage,
    reason?: string,
    kind: ReportKind = ReportKind.SPAM,
  ): Promise<DefaultResponse> {
    return await this.report_messages(chatId, [message], reason, kind);
  }

  async invoke<TResponse>(
    serviceName: string,
    method: string,
    requestType: string,
    responseType: string | undefined,
    payload: object,
  ): Promise<TResponse> {
    if (this.websocket) {
      return await this.websocket.request<TResponse>(
        serviceName,
        method,
        requestType,
        payload,
        responseType,
      );
    }

    return await this.post<TResponse>(
      serviceName,
      method,
      requestType,
      responseType,
      payload,
    );
  }

  async post<TResponse>(
    serviceName: string,
    method: string,
    requestType: string,
    responseType: string | undefined,
    payload: object,
  ): Promise<TResponse> {
    if (!responseType) {
      throw new ClientStateError(`A response type is required for ${serviceName}/${method}`);
    }

    const session = this.session ?? (await this.load_session());
    return await this.grpcConnection.request<TResponse>(
      serviceName,
      method,
      requestType,
      responseType,
      payload,
      {
        accessToken: session?.jwt,
      },
    );
  }

  private async authenticate(): Promise<SessionState> {
    let sentCode: Record<string, any>;

    try {
      sentCode = await this.start_phone_auth(this.token_or_phone_number);
    } catch (error) {
      if (error instanceof BaleRpcError && error.message === "PHONE_NUMBER_INVALID") {
        throw new AuthenticationError(
          `Bale rejected the phone number as invalid. Use a real phone number in international format, for example "+989121234567", or pass an existing session string instead. ${formatPhoneNumberInputHint(this.token_or_phone_number)}`,
        );
      }

      throw error;
    }

    const reader = createInterface({ input, output });

    try {
      while (true) {
        const code = await reader.question("Enter phone code: ");

        try {
          const auth = await this.validate_code(sentCode.transaction_hash, code.trim());
          return this.parseAuthResponse(auth);
        } catch (error) {
          if (!(error instanceof BaleRpcError)) {
            throw error;
          }

          if (error.message === "PHONE_NUMBER_UNOCCUPIED") {
            const name = await reader.question("Enter a name for your account: ");
            const auth = await this.sign_up(sentCode.transaction_hash, name.trim());
            return this.parseAuthResponse(auth);
          }

          if (error.message === "PHONE_CODE_INVALID") {
            continue;
          }

          if (!error.message || /password/i.test(error.message)) {
            const password = await reader.question("Enter your password: ");
            const auth = await this.validate_password(sentCode.transaction_hash, password.trim());
            return this.parseAuthResponse(auth);
          }

          throw error;
        }
      }
    } finally {
      reader.close();
    }
  }

  private parseAuthResponse(response: Record<string, any>): SessionState {
    const userId = Number(response.user?.id);
    const jwt = response.jwt?.value;

    if (!userId || !jwt) {
      throw new AuthenticationError("Bale authentication response is incomplete");
    }

    return {
      userId,
      jwt,
    };
  }

  private createOutboundMessage(
    peer: { id: number; type: number },
    rid: number | string,
    date: unknown,
    message: Record<string, any>,
  ): Message {
    return this.wrapIncomingMessage({
      peer,
      sender_uid: this.user?.id ?? this.session?.userId ?? 0,
      date: Number(date ?? Date.now()),
      rid,
      message,
    });
  }

  private async loadHistory(peer: { id: number; type: number }, date: number, limit: number): Promise<Record<string, any>> {
    return await this.invoke<Record<string, any>>(
      "bale.messaging.v2.Messaging",
      "LoadHistory",
      "request.LoadHistory",
      "response.LoadHistory",
      {
        peer,
        date,
        load_mode: 2,
        limit,
      },
    );
  }

  private async findHistoryMessage(
    peer: { id: number; type: number },
    messageId: { rid: string; date: number },
  ): Promise<Record<string, any> | undefined> {
    const history = await this.loadHistory(peer, messageId.date, 20);
    const items = Array.isArray(history.history) ? history.history : [];
    return items.find((item) => String(item.rid) === messageId.rid);
  }

  private requirePeer(chatId: string | Chat): { id: number; type: number } {
    if (chatId instanceof Chat) {
      return {
        id: chatId.peerId,
        type: chatId.peerType,
      };
    }

    const parsed = parsePeerString(chatId);
    if (!parsed) {
      throw new TypeError(`Expected a Bale peer id like "123|1", received "${chatId}"`);
    }

    return parsed;
  }

  private requireGroupPeer(chatId: string | Chat): { group_id: number; access_hash: number } {
    const peer = this.requirePeer(chatId);
    return {
      group_id: peer.id,
      access_hash: 1,
    };
  }

  private requireUserOutPeer(user: number | string | User): { uid: number; access_hash: number } {
    if (user instanceof User) {
      return {
        uid: user.id,
        access_hash: 1,
      };
    }

    if (typeof user === "number") {
      return {
        uid: user,
        access_hash: 1,
      };
    }

    const parsed = parsePeerString(user);
    if (parsed && (parsed.type === 1 || parsed.type === 4)) {
      return {
        uid: parsed.id,
        access_hash: 1,
      };
    }

    const numericUserId = Number(user);
    if (!Number.isNaN(numericUserId) && numericUserId > 0) {
      return {
        uid: numericUserId,
        access_hash: 1,
      };
    }

    throw new TypeError(`Expected a Bale user id or user peer, received "${user}"`);
  }

  private requireExPeer(chatId: string | Chat): { id: number; type: number; access_hash: number } {
    const peer = this.requirePeer(chatId);
    return {
      id: peer.id,
      type: peer.type,
      access_hash: 1,
    };
  }

  private requireOutPeer(chatId: string | Chat): { id: number; type: number; access_hash: number } {
    const peer = this.requirePeer(chatId);
    return {
      id: peer.id,
      type: peer.type,
      access_hash: 1,
    };
  }

  private ensureOtherMessage(message: Message | OtherMessage): { date: number; message_id: number | string; seq?: { value: number } } {
    if (message instanceof OtherMessage) {
      return {
        date: message.date,
        message_id: message.message_id,
        seq: message.seq !== undefined ? { value: message.seq } : undefined,
      };
    }

    return {
      date: message.date,
      message_id: message.rid,
    };
  }

  private ensureInfoMessage(message: Message): { peer: { id: number; type: number }; message_id: number | string; date: number } {
    return {
      peer: this.requirePeer(message.chat),
      message_id: message.message_id,
      date: message.date,
    };
  }

  private toMessageIdentifier(message: string | Message | OtherMessage): { date: number; rid: number | string; seq?: number } {
    if (typeof message === "string") {
      const parsed = parseMessageId(message);
      return {
        rid: parsed.rid,
        date: parsed.date,
      };
    }

    if (message instanceof OtherMessage) {
      return {
        rid: message.message_id,
        date: message.date,
        seq: message.seq,
      };
    }

    return {
      rid: message.rid,
      date: message.date,
    };
  }

  private async loadPeer(peerId: number, peerType: number): Promise<User | Chat | undefined> {
    const cacheKey = `${peerId}|${peerType}`;
    const cachedPeer = this.peerCache.get(cacheKey);
    if (cachedPeer) {
      return cachedPeer;
    }

    const inflightPeerLoad = this.inflightPeerLoads.get(cacheKey);
    if (inflightPeerLoad) {
      return await inflightPeerLoad;
    }

    const loadPromise = this.loadPeerUncached(peerId, peerType, cacheKey);
    this.inflightPeerLoads.set(cacheKey, loadPromise);

    try {
      return await loadPromise;
    } finally {
      this.inflightPeerLoads.delete(cacheKey);
    }
  }

  private async loadPeerUncached(
    peerId: number,
    peerType: number,
    cacheKey: string,
  ): Promise<User | Chat | undefined> {
    if (peerType === 1 || peerType === 4) {
      const response = await this.invoke<Record<string, any>>(
        "bale.users.v1.Users",
        "LoadUsers",
        "request.LoadUsers",
        "response.LoadUsers",
        {
          user_peers: [
            {
              uid: peerId,
              access_hash: 1,
            },
          ],
        },
      );

      if (!response.users?.length) {
        return undefined;
      }

      const user = wrapUser(response.users[0]);
      user.bind(this);
      this.peerCache.set(cacheKey, user);
      this.peerCache.set(`${user.id}|1`, user);
      if (user.isBot) {
        this.peerCache.set(`${user.id}|4`, user);
      }
      return user;
    }

    const response = await this.invoke<Record<string, any>>(
      "bale.groups.v1.Groups",
      "GetFullGroup",
      "request.GetFullGroup",
      "response.GetFullGroup",
      {
        peer: {
          group_id: peerId,
          access_hash: 1,
        },
      },
    );

    if (!response.full_group) {
      return undefined;
    }

    const chat = wrapGroup(response.full_group);
    chat.bind(this);
    this.peerCache.set(cacheKey, chat);
    this.peerCache.set(chat.id, chat);
    return chat;
  }

  private async load_session(): Promise<SessionState | undefined> {
    const sessionPath = this.getSessionPath();

    try {
      await access(sessionPath);
    } catch {
      return undefined;
    }

    const rawSession = await readFile(sessionPath, "utf8");
    return parseSessionString(rawSession);
  }

  private async save_session(session: SessionState): Promise<void> {
    await mkdir(this.sessionDir, { recursive: true });
    await writeFile(this.getSessionPath(), formatSessionString(session), "utf8");
  }

  private getSessionPath(): string {
    return path.join(this.sessionDir, `${this.token_or_phone_number}.session`);
  }

  private async handleUpdate(update: Record<string, unknown>): Promise<void> {
    const rawMessage = (update.update as Record<string, any> | undefined)?.composed_update?.message;
    if (!rawMessage || Number(rawMessage.rid) === 0) {
      return;
    }

    const message = this.wrapIncomingMessage(rawMessage);
    await this.dispatcher.dispatchMessage(this, message);
  }

  private wrapIncomingMessage(rawMessage: Record<string, any>): Message {
    const peerId = Number(rawMessage.peer?.id);
    const peerType = Number(rawMessage.peer?.type);
    const chatKey = `${peerId}|${peerType}`;
    let chat = this.messageChatCache.get(chatKey);
    if (!chat) {
      chat = new Chat({
        peerId,
        peerType,
      });
      chat.bind(this);
      this.messageChatCache.set(chatKey, chat);
    }

    const authorId = Number(rawMessage.sender_uid ?? 0);
    let author = this.messageAuthorCache.get(authorId);
    if (!author) {
      author = new User({
        id: authorId,
      });
      author.bind(this);
      this.messageAuthorCache.set(authorId, author);
    }

    const message = wrapMessageFromUpdate(rawMessage, { chat, author });
    message.bind(this);
    return message;
  }

  private async handleDisconnect(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;
    await this.dispatcher.dispatchLifecycle("disconnect", this);
    if (this.stopResolver) {
      this.stopResolver();
      this.stopResolver = undefined;
    }
  }
}
