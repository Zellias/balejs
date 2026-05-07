import type { Client } from "../client";

export enum ChatType {
  PRIVATE = "private",
  GROUP = "group",
  CHANNEL = "channel",
  BOT = "bot",
  SUPERGROUP = "supergroup",
  THREAD = "thread",
  UNKNOWN = "unknown",
}

export enum GivingType {
  SAME = 0,
  RANDOM = 1,
}

export enum GiftOpenning {
  ALREADY_RECEIVED = 0,
  SOLD_OUT = 1,
  GIFT_CREATOR = 2,
  SUCCESSFUL = 3,
  PENDING = 4,
}

export enum ReportKind {
  UNKNOWN = 0,
  SCAM = 1,
  INAPPROPRIATE_CONTENT = 2,
  OTHER = 3,
  VIOLENCE = 4,
  SPAM = 5,
  FALSE_INFORMATION = 6,
}

export enum PeerSource {
  UNKNOWN = 0,
  DIALOGS = 1,
  VITRINE = 2,
  MARKET = 3,
  PRIVACY_BAR = 4,
}

export interface Bindable {
  bind(client: Client): void;
}

export interface UserOptions {
  id: number;
  username?: string;
  name?: string;
  isBot?: boolean;
}

export interface ChatOptions {
  peerId: number;
  peerType: number;
  title?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  type?: ChatType;
}

export interface MessageOptions {
  rid: number | string;
  date: number;
  author: User;
  chat: Chat;
  text?: string;
  caption?: string;
  gift?: GiftPacket;
  raw?: unknown;
}

export interface MessageWrapContext {
  author?: User;
  chat?: Chat;
}

export interface GiftPacketOptions {
  count?: number;
  totalAmount?: number;
  givingType?: GivingType;
  token?: string;
  message?: string;
  ownerId?: number;
  showAmounts?: boolean;
}

export interface WinnerOptions {
  id: number;
  amount?: number;
  date?: number;
}

export interface PacketResponseOptions {
  receivers?: Winner[];
  status?: GiftOpenning;
  opennedCount?: number;
  winAmount?: number;
  rank?: number;
}

export interface WalletOptions {
  isMerchant?: boolean;
  app?: string;
  balance?: number;
  token: string;
  level?: number;
  pan?: string;
  account?: string;
}

export interface WalletResponseOptions {
  wallet?: Wallet;
  firstName?: string;
  lastName?: string;
}

export interface DefaultResponseOptions {
  seq?: number;
  date?: number;
}

export interface OtherMessageOptions {
  date: number;
  messageId: number | string;
  seq?: number;
}

export class User implements Bindable {
  readonly id: number;
  readonly username?: string;
  readonly name?: string;
  readonly isBot: boolean;
  protected client?: Client;

  constructor(options: UserOptions) {
    this.id = options.id;
    this.username = options.username;
    this.name = options.name;
    this.isBot = options.isBot ?? false;
  }

  get full_name(): string {
    return this.name ?? "";
  }

  bind(client: Client): void {
    this.client = client;
  }
}

export class Chat implements Bindable {
  readonly peerId: number;
  readonly peerType: number;
  readonly id: string;
  readonly title?: string;
  readonly username?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly type: ChatType;
  protected client?: Client;

  constructor(options: ChatOptions) {
    this.peerId = options.peerId;
    this.peerType = options.peerType;
    this.id = `${options.peerId}|${options.peerType}`;
    this.title = options.title;
    this.username = options.username;
    this.firstName = options.firstName;
    this.lastName = options.lastName;
    this.type = options.type ?? peerTypeToChatType(options.peerType);
  }

  get full_name(): string {
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`;
    }

    if (this.firstName) {
      return this.firstName;
    }

    return this.title ?? "";
  }

  async send(text: string): Promise<unknown> {
    if (!this.client) {
      throw new Error("Chat is not bound to a client");
    }

    return await this.client.send_message(this.id, text);
  }

  async load_history(limit = 20, fromDate = -1): Promise<Message[]> {
    if (!this.client) {
      throw new Error("Chat is not bound to a client");
    }

    return await this.client.load_history(this.id, fromDate, limit);
  }

  async send_gift(
    amount: number,
    message: string,
    options?: {
      gift_count?: number;
      giving_type?: GivingType;
      show_amounts?: boolean;
      token?: string;
    },
  ): Promise<unknown> {
    if (!this.client) {
      throw new Error("Chat is not bound to a client");
    }

    return await this.client.send_gift(this.id, amount, message, options);
  }

  async send_giftpacket(
    amount: number,
    message: string,
    options?: {
      gift_count?: number;
      giving_type?: GivingType;
      show_amounts?: boolean;
      token?: string;
    },
  ): Promise<unknown> {
    return await this.send_gift(amount, message, options);
  }

  async report(reason?: string, kind: ReportKind = ReportKind.SPAM): Promise<unknown> {
    if (!this.client) {
      throw new Error("Chat is not bound to a client");
    }

    return await this.client.report_chat(this.id, reason, kind);
  }

  bind(client: Client): void {
    this.client = client;
  }
}

export class Message implements Bindable {
  readonly rid: number | string;
  readonly date: number;
  readonly id: string;
  readonly author: User;
  readonly chat: Chat;
  readonly text?: string;
  readonly caption?: string;
  readonly gift?: GiftPacket;
  readonly raw?: unknown;
  protected client?: Client;

  constructor(options: MessageOptions) {
    this.rid = options.rid;
    this.date = options.date;
    this.id = `${options.rid}|${options.date}`;
    this.author = options.author;
    this.chat = options.chat;
    this.text = options.text;
    this.caption = options.caption;
    this.gift = options.gift;
    this.raw = options.raw;
  }

  get message_id(): number | string {
    return this.rid;
  }

  get content(): string {
    return this.text ?? this.caption ?? "";
  }

  async reply(text: string): Promise<unknown> {
    if (!this.client) {
      throw new Error("Message is not bound to a client");
    }

    return await this.client.send_message(this.chat.id, text);
  }

  async edit_text(text: string): Promise<unknown> {
    if (!this.client) {
      throw new Error("Message is not bound to a client");
    }

    return await this.client.edit_message_text(this.chat.id, this.id, text);
  }

  async delete(): Promise<unknown> {
    if (!this.client) {
      throw new Error("Message is not bound to a client");
    }

    return await this.client.delete_message(this.chat.id, this.id);
  }

  async forward(chatId: string): Promise<unknown> {
    if (!this.client) {
      throw new Error("Message is not bound to a client");
    }

    return await this.client.forward_message(chatId, this.chat.id, this.id);
  }

  async copy(chatId: string): Promise<unknown> {
    if (!this.client) {
      throw new Error("Message is not bound to a client");
    }

    return await this.client.copy_message(chatId, this.chat.id, this.id);
  }

  async open_gift(receiverToken?: string): Promise<unknown> {
    if (!this.client) {
      throw new Error("Message is not bound to a client");
    }

    return await this.client.open_gift(this, receiverToken);
  }

  async open_packet(receiverToken?: string): Promise<unknown> {
    return await this.open_gift(receiverToken);
  }

  async report(reason?: string, kind: ReportKind = ReportKind.SPAM): Promise<unknown> {
    if (!this.client) {
      throw new Error("Message is not bound to a client");
    }

    return await this.client.report_message(this.chat.id, this, reason, kind);
  }

  bind(client: Client): void {
    this.client = client;
    this.author.bind(client);
    this.chat.bind(client);
    this.gift?.bind(client);
  }
}

export class GiftPacket implements Bindable {
  readonly count: number;
  readonly total_amount: number;
  readonly giving_type: GivingType;
  readonly token?: string;
  readonly message?: string;
  readonly owner_id?: number;
  readonly show_amounts: boolean;
  protected client?: Client;

  constructor(options: GiftPacketOptions = {}) {
    this.count = options.count ?? 0;
    this.total_amount = options.totalAmount ?? 0;
    this.giving_type = options.givingType ?? GivingType.SAME;
    this.token = options.token;
    this.message = options.message;
    this.owner_id = options.ownerId;
    this.show_amounts = options.showAmounts ?? false;
  }

  bind(client: Client): void {
    this.client = client;
  }
}

export class Winner {
  readonly id: number;
  readonly amount: number;
  readonly date?: number;

  constructor(options: WinnerOptions) {
    this.id = options.id;
    this.amount = options.amount ?? 0;
    this.date = options.date;
  }
}

export class PacketResponse {
  readonly receivers: Winner[];
  readonly status: GiftOpenning;
  readonly openned_count: number;
  readonly win_amount: number;
  readonly rank: number;

  constructor(options: PacketResponseOptions = {}) {
    this.receivers = options.receivers ?? [];
    this.status = options.status ?? GiftOpenning.ALREADY_RECEIVED;
    this.openned_count = options.opennedCount ?? 0;
    this.win_amount = options.winAmount ?? 0;
    this.rank = options.rank ?? 0;
  }
}

export class Wallet {
  readonly is_merchant: boolean;
  readonly app?: string;
  readonly balance: number;
  readonly token: string;
  readonly level: number;
  readonly pan?: string;
  readonly account?: string;

  constructor(options: WalletOptions) {
    this.is_merchant = options.isMerchant ?? false;
    this.app = options.app;
    this.balance = options.balance ?? 0;
    this.token = options.token;
    this.level = options.level ?? 0;
    this.pan = options.pan;
    this.account = options.account;
  }
}

export class WalletResponse {
  readonly wallet?: Wallet;
  readonly first_name?: string;
  readonly last_name?: string;

  constructor(options: WalletResponseOptions = {}) {
    this.wallet = options.wallet;
    this.first_name = options.firstName;
    this.last_name = options.lastName;
  }
}

export class DefaultResponse {
  readonly seq?: number;
  readonly date?: number;

  constructor(options: DefaultResponseOptions = {}) {
    this.seq = options.seq;
    this.date = options.date;
  }
}

export class OtherMessage {
  readonly date: number;
  readonly message_id: number | string;
  readonly seq?: number;

  constructor(options: OtherMessageOptions) {
    this.date = options.date;
    this.message_id = options.messageId;
    this.seq = options.seq;
  }
}

export function peerTypeToChatType(peerType: number): ChatType {
  switch (peerType) {
    case 1:
      return ChatType.PRIVATE;
    case 2:
      return ChatType.GROUP;
    case 3:
      return ChatType.CHANNEL;
    case 4:
      return ChatType.BOT;
    case 5:
      return ChatType.SUPERGROUP;
    case 6:
      return ChatType.THREAD;
    default:
      return ChatType.UNKNOWN;
  }
}

export function groupTypeToPeerType(groupType: string | number | undefined): number {
  if (groupType === "GROUP_TYPE_CHANNEL" || groupType === 1) {
    return 3;
  }

  if (groupType === "GROUP_TYPE_SUPER_GROUP" || groupType === 2) {
    return 5;
  }

  return 2;
}

export function wrapUser(raw: Record<string, any>): User {
  return new User({
    id: Number(raw.id),
    username: raw.nick?.value,
    name: raw.name,
    isBot: Boolean(raw.is_bot?.value),
  });
}

export function wrapGroup(raw: Record<string, any>): Chat {
  return new Chat({
    peerId: Number(raw.id),
    peerType: groupTypeToPeerType(raw.group_type),
    title: raw.title,
    username: raw.nick?.value,
  });
}

export function wrapMessageFromUpdate(raw: Record<string, any>, context: MessageWrapContext = {}): Message {
  const chat = context.chat ?? new Chat({
    peerId: Number(raw.peer?.id),
    peerType: Number(raw.peer?.type),
  });

  const author = context.author ?? new User({
    id: Number(raw.sender_uid),
  });

  return new Message({
    rid: typeof raw.rid === "string" ? raw.rid : String(raw.rid),
    date: Number(raw.date),
    author,
    chat,
    text: raw.message?.text_message?.text,
    caption: raw.message?.document_message?.caption?.text,
    gift: raw.message?.gift ? wrapGiftPacket(raw.message.gift) : undefined,
    raw,
  });
}

export function wrapGiftPacket(raw: Record<string, any>): GiftPacket {
  return new GiftPacket({
    count: Number(raw.count ?? 0),
    totalAmount: Number(raw.total_amount ?? 0),
    givingType: raw.giving_type === "GIVING_TYPE_RANDOM" || raw.giving_type === 1 ? GivingType.RANDOM : GivingType.SAME,
    token: raw.token?.value,
    message: raw.message?.value,
    ownerId: raw.owner_id !== undefined ? Number(raw.owner_id) : undefined,
    showAmounts: Boolean(raw.show_amounts?.value),
  });
}

export function wrapWinner(raw: Record<string, any>): Winner {
  return new Winner({
    id: Number(raw.id),
    amount: Number(raw.amount ?? 0),
    date: raw.date !== undefined ? Number(raw.date) : undefined,
  });
}

export function wrapPacketResponse(raw: Record<string, any>): PacketResponse {
  return new PacketResponse({
    receivers: Array.isArray(raw.receivers) ? raw.receivers.map(wrapWinner) : [],
    status: typeof raw.status === "string" ? giftOpenningFromString(raw.status) : Number(raw.status ?? 0),
    opennedCount: Number(raw.openned_count ?? 0),
    winAmount: Number(raw.win_amount?.value ?? 0),
    rank: Number(raw.rank?.value ?? 0),
  });
}

export function wrapWallet(raw: Record<string, any>): Wallet {
  return new Wallet({
    isMerchant: Boolean(raw.is_merchant?.value),
    app: raw.app,
    balance: Number(raw.balance ?? 0),
    token: raw.token,
    level: Number(raw.level ?? 0),
    pan: raw.pan?.value,
    account: raw.account?.value,
  });
}

export function wrapWalletResponse(raw: Record<string, any>): WalletResponse {
  const walletValue = Array.isArray(raw.wallet) ? raw.wallet[0] : raw.wallet;
  return new WalletResponse({
    wallet: walletValue ? wrapWallet(walletValue) : undefined,
    firstName: raw.first_name?.value,
    lastName: raw.last_name?.value,
  });
}

export function wrapDefaultResponse(raw: Record<string, any>): DefaultResponse {
  return new DefaultResponse({
    seq: raw.seq !== undefined ? Number(raw.seq) : undefined,
    date: raw.date !== undefined ? Number(raw.date) : undefined,
  });
}

function giftOpenningFromString(value: string): GiftOpenning {
  switch (value) {
    case "GIFT_OPENNING_SOLD_OUT":
      return GiftOpenning.SOLD_OUT;
    case "GIFT_OPENNING_GIFT_CREATOR":
      return GiftOpenning.GIFT_CREATOR;
    case "GIFT_OPENNING_SUCCESSFUL":
      return GiftOpenning.SUCCESSFUL;
    case "GIFT_OPENNING_PENDING":
      return GiftOpenning.PENDING;
    default:
      return GiftOpenning.ALREADY_RECEIVED;
  }
}
