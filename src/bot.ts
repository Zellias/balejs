import { readFile } from "node:fs/promises";

import { AuthenticationError, BaleRpcError, ClientStateError } from "./errors";

type BotFetch = typeof fetch;
type UnknownRecord = Record<string, unknown>;
type BotHandler<T> = (payload: T, client: BotClient) => unknown | Promise<unknown>;
type ErrorHandler = (error: unknown, client: BotClient) => unknown | Promise<unknown>;

export interface BotClientOptions {
  baseUrl?: string;
  fetch?: BotFetch;
  pollTimeoutSeconds?: number;
  pollLimit?: number;
  pollIntervalMs?: number;
  allowedUpdates?: string[];
  requestTimeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
}

export interface BotApiResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
  error_code?: number;
  parameters?: UnknownRecord;
}

export interface LabeledPrice {
  label: string;
  amount: number;
}

export interface ShippingOption {
  id: string;
  title: string;
  prices: Array<LabeledPrice | UnknownRecord>;
}

export interface BotInvoiceOptions extends UnknownRecord {
  title: string;
  description: string;
  payload: string;
  provider_token?: string;
  start_parameter?: string;
  currency?: string;
  prices: Array<LabeledPrice | UnknownRecord>;
}

export interface CreateInvoiceLinkOptions extends UnknownRecord {
  title: string;
  description: string;
  payload: string;
  provider_token?: string;
  currency?: string;
  prices: Array<LabeledPrice | UnknownRecord>;
}

export interface BotUser extends UnknownRecord {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface BotChat extends UnknownRecord {
  id: number | string;
  type?: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface BotSuccessfulPayment extends UnknownRecord {
  currency?: string;
  total_amount?: number;
  invoice_payload?: string;
  shipping_option_id?: string;
  telegram_payment_charge_id?: string;
  provider_payment_charge_id?: string;
}

export interface BotMessage extends UnknownRecord {
  message_id?: number;
  date?: number;
  text?: string;
  caption?: string;
  from?: BotUser;
  chat?: BotChat;
  photo?: unknown[];
  audio?: UnknownRecord;
  document?: UnknownRecord;
  video?: UnknownRecord;
  animation?: UnknownRecord;
  voice?: UnknownRecord;
  sticker?: UnknownRecord;
  location?: UnknownRecord;
  contact?: UnknownRecord;
  invoice?: UnknownRecord;
  successful_payment?: BotSuccessfulPayment;
  new_chat_members?: UnknownRecord[];
  left_chat_member?: UnknownRecord;
  web_app_data?: UnknownRecord;
}

export interface BotCallbackQuery extends UnknownRecord {
  id: string;
  from?: BotUser;
  message?: BotMessage;
  inline_message_id?: string;
  chat_instance?: string;
  data?: string;
}

export interface BotPreCheckoutQuery extends UnknownRecord {
  id: string;
  from?: BotUser;
  currency?: string;
  total_amount?: number;
  invoice_payload?: string;
}

export interface BotShippingQuery extends UnknownRecord {
  id: string;
  from?: BotUser;
  invoice_payload?: string;
  shipping_address?: UnknownRecord;
}

export interface BotFile extends UnknownRecord {
  file_id?: string;
  file_unique_id?: string;
  file_size?: number;
  file_path?: string;
}

export interface BotUpdate {
  update_id: number;
  message?: BotMessage;
  edited_message?: BotMessage;
  channel_post?: BotMessage;
  edited_channel_post?: BotMessage;
  callback_query?: BotCallbackQuery;
  inline_query?: UnknownRecord;
  chosen_inline_result?: UnknownRecord;
  shipping_query?: BotShippingQuery;
  pre_checkout_query?: BotPreCheckoutQuery;
  poll?: UnknownRecord;
  poll_answer?: UnknownRecord;
  [key: string]: unknown;
}

export class BotInputFile {
  readonly value: Blob;
  readonly filename: string;

  constructor(value: Blob, filename: string) {
    this.value = value;
    this.filename = filename;
  }

  static async fromPath(filePath: string, filename?: string, contentType?: string): Promise<BotInputFile> {
    const buffer = await readFile(filePath);
    const finalName =
      filename ??
      filePath.replace(/\\/g, "/").split("/").filter(Boolean).at(-1) ??
      "file";
    return BotInputFile.fromBuffer(buffer, finalName, contentType);
  }

  static fromBuffer(
    buffer: Buffer | Uint8Array | ArrayBuffer,
    filename: string,
    contentType = "application/octet-stream",
  ): BotInputFile {
    const bytes =
      buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const stableBytes = new Uint8Array(bytes);
    return new BotInputFile(new Blob([stableBytes], { type: contentType }), filename);
  }

  static fromBlob(blob: Blob, filename: string): BotInputFile {
    return new BotInputFile(blob, filename);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isRetriableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function createTimeoutSignal(timeoutMs: number): AbortSignal | undefined {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined;
  }

  const controller = new AbortController();
  setTimeout(() => {
    controller.abort();
  }, timeoutMs).unref?.();
  return controller.signal;
}

function mergeAbortSignals(...signals: Array<AbortSignal | undefined>): AbortSignal | undefined {
  const activeSignals = signals.filter(Boolean);
  if (activeSignals.length === 0) {
    return undefined;
  }

  const controller = new AbortController();
  const abort = () => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  };

  for (const signal of activeSignals) {
    if (signal?.aborted) {
      abort();
      break;
    }
    signal?.addEventListener("abort", abort, { once: true });
  }

  return controller.signal;
}

function isPlainObject(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasUpload(value: unknown): boolean {
  if (value instanceof BotInputFile) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((entry) => hasUpload(entry));
  }

  if (isPlainObject(value)) {
    return Object.values(value).some((entry) => hasUpload(entry));
  }

  return false;
}

function appendFormValue(form: FormData, key: string, value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }

  if (value instanceof BotInputFile) {
    form.append(key, value.value, value.filename);
    return;
  }

  if (Array.isArray(value) || isPlainObject(value)) {
    form.append(key, JSON.stringify(value));
    return;
  }

  form.append(key, String(value));
}

function hasArrayItems(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function normalizeProviderToken<T extends UnknownRecord>(options: T): T {
  const providerToken =
    typeof options.provider_token === "string" && options.provider_token.trim()
      ? options.provider_token.trim()
      : undefined;

  if (!providerToken) {
    throw new TypeError('Bale payments require "provider_token".');
  }

  const normalized = { ...options, provider_token: providerToken };
  return normalized;
}

export class BotClient {
  readonly token: string;
  readonly baseUrl: string;
  readonly pollTimeoutSeconds: number;
  readonly pollLimit: number;
  readonly pollIntervalMs: number;
  readonly allowedUpdates?: string[];
  readonly requestTimeoutMs: number;
  readonly maxRetries: number;
  readonly retryBaseDelayMs: number;

  private readonly fetchImpl: BotFetch;
  private readonly updateHandlers: Array<BotHandler<BotUpdate>> = [];
  private readonly messageHandlers: Array<BotHandler<BotMessage>> = [];
  private readonly editedMessageHandlers: Array<BotHandler<BotMessage>> = [];
  private readonly channelPostHandlers: Array<BotHandler<BotMessage>> = [];
  private readonly editedChannelPostHandlers: Array<BotHandler<BotMessage>> = [];
  private readonly callbackQueryHandlers: Array<BotHandler<BotCallbackQuery>> = [];
  private readonly shippingQueryHandlers: Array<BotHandler<BotShippingQuery>> = [];
  private readonly preCheckoutQueryHandlers: Array<BotHandler<BotPreCheckoutQuery>> = [];
  private readonly successfulPaymentHandlers: Array<BotHandler<BotSuccessfulPayment & { message: BotMessage }>> = [];
  private readonly textHandlers: Array<BotHandler<BotMessage>> = [];
  private readonly photoHandlers: Array<BotHandler<BotMessage>> = [];
  private readonly audioHandlers: Array<BotHandler<BotMessage>> = [];
  private readonly documentHandlers: Array<BotHandler<BotMessage>> = [];
  private readonly videoHandlers: Array<BotHandler<BotMessage>> = [];
  private readonly animationHandlers: Array<BotHandler<BotMessage>> = [];
  private readonly voiceHandlers: Array<BotHandler<BotMessage>> = [];
  private readonly stickerHandlers: Array<BotHandler<BotMessage>> = [];
  private readonly contactHandlers: Array<BotHandler<BotMessage>> = [];
  private readonly locationHandlers: Array<BotHandler<BotMessage>> = [];
  private readonly invoiceHandlers: Array<BotHandler<BotMessage>> = [];
  private readonly webAppDataHandlers: Array<BotHandler<BotMessage>> = [];
  private readonly newChatMembersHandlers: Array<BotHandler<BotMessage>> = [];
  private readonly leftChatMemberHandlers: Array<BotHandler<BotMessage>> = [];
  private readonly pollHandlers: Array<BotHandler<UnknownRecord>> = [];
  private readonly pollAnswerHandlers: Array<BotHandler<UnknownRecord>> = [];
  private readonly errorHandlers: Array<ErrorHandler> = [];
  private running = false;
  private offset = 0;
  private activePollController?: AbortController;
  me?: UnknownRecord;

  constructor(token: string, options: BotClientOptions = {}) {
    const trimmed = String(token || "").trim();
    if (!trimmed) {
      throw new AuthenticationError("A Bale bot token is required");
    }

    this.token = trimmed;
    this.baseUrl = `${(options.baseUrl ?? "https://tapi.bale.ai/bot").replace(/\/+$/, "")}${trimmed}/`;
    this.fetchImpl = options.fetch ?? fetch;
    this.pollTimeoutSeconds = Math.max(0, Math.floor(options.pollTimeoutSeconds ?? 30));
    this.pollLimit = Math.max(1, Math.floor(options.pollLimit ?? 100));
    this.pollIntervalMs = Math.max(0, Math.floor(options.pollIntervalMs ?? 250));
    this.allowedUpdates = options.allowedUpdates?.map((value) => String(value));
    this.requestTimeoutMs = Math.max(1_000, Math.floor(options.requestTimeoutMs ?? 45_000));
    this.maxRetries = Math.max(0, Math.floor(options.maxRetries ?? 2));
    this.retryBaseDelayMs = Math.max(100, Math.floor(options.retryBaseDelayMs ?? 500));
  }

  on_update(callback: BotHandler<BotUpdate>): BotHandler<BotUpdate> {
    this.updateHandlers.push(callback);
    return callback;
  }

  on_message(callback: BotHandler<BotMessage>): BotHandler<BotMessage> {
    this.messageHandlers.push(callback);
    return callback;
  }

  on_edited_message(callback: BotHandler<BotMessage>): BotHandler<BotMessage> {
    this.editedMessageHandlers.push(callback);
    return callback;
  }

  on_channel_post(callback: BotHandler<BotMessage>): BotHandler<BotMessage> {
    this.channelPostHandlers.push(callback);
    return callback;
  }

  on_edited_channel_post(callback: BotHandler<BotMessage>): BotHandler<BotMessage> {
    this.editedChannelPostHandlers.push(callback);
    return callback;
  }

  on_callback_query(callback: BotHandler<BotCallbackQuery>): BotHandler<BotCallbackQuery> {
    this.callbackQueryHandlers.push(callback);
    return callback;
  }

  on_shipping_query(callback: BotHandler<BotShippingQuery>): BotHandler<BotShippingQuery> {
    this.shippingQueryHandlers.push(callback);
    return callback;
  }

  on_pre_checkout_query(callback: BotHandler<BotPreCheckoutQuery>): BotHandler<BotPreCheckoutQuery> {
    this.preCheckoutQueryHandlers.push(callback);
    return callback;
  }

  on_successful_payment(
    callback: BotHandler<BotSuccessfulPayment & { message: BotMessage }>,
  ): BotHandler<BotSuccessfulPayment & { message: BotMessage }> {
    this.successfulPaymentHandlers.push(callback);
    return callback;
  }

  on_text(callback: BotHandler<BotMessage>): BotHandler<BotMessage> {
    this.textHandlers.push(callback);
    return callback;
  }

  on_photo(callback: BotHandler<BotMessage>): BotHandler<BotMessage> {
    this.photoHandlers.push(callback);
    return callback;
  }

  on_audio(callback: BotHandler<BotMessage>): BotHandler<BotMessage> {
    this.audioHandlers.push(callback);
    return callback;
  }

  on_document(callback: BotHandler<BotMessage>): BotHandler<BotMessage> {
    this.documentHandlers.push(callback);
    return callback;
  }

  on_video(callback: BotHandler<BotMessage>): BotHandler<BotMessage> {
    this.videoHandlers.push(callback);
    return callback;
  }

  on_animation(callback: BotHandler<BotMessage>): BotHandler<BotMessage> {
    this.animationHandlers.push(callback);
    return callback;
  }

  on_voice(callback: BotHandler<BotMessage>): BotHandler<BotMessage> {
    this.voiceHandlers.push(callback);
    return callback;
  }

  on_sticker(callback: BotHandler<BotMessage>): BotHandler<BotMessage> {
    this.stickerHandlers.push(callback);
    return callback;
  }

  on_contact(callback: BotHandler<BotMessage>): BotHandler<BotMessage> {
    this.contactHandlers.push(callback);
    return callback;
  }

  on_location(callback: BotHandler<BotMessage>): BotHandler<BotMessage> {
    this.locationHandlers.push(callback);
    return callback;
  }

  on_invoice(callback: BotHandler<BotMessage>): BotHandler<BotMessage> {
    this.invoiceHandlers.push(callback);
    return callback;
  }

  on_web_app_data(callback: BotHandler<BotMessage>): BotHandler<BotMessage> {
    this.webAppDataHandlers.push(callback);
    return callback;
  }

  on_new_chat_members(callback: BotHandler<BotMessage>): BotHandler<BotMessage> {
    this.newChatMembersHandlers.push(callback);
    return callback;
  }

  on_left_chat_member(callback: BotHandler<BotMessage>): BotHandler<BotMessage> {
    this.leftChatMemberHandlers.push(callback);
    return callback;
  }

  on_poll(callback: BotHandler<UnknownRecord>): BotHandler<UnknownRecord> {
    this.pollHandlers.push(callback);
    return callback;
  }

  on_poll_answer(callback: BotHandler<UnknownRecord>): BotHandler<UnknownRecord> {
    this.pollAnswerHandlers.push(callback);
    return callback;
  }

  on_error(callback: ErrorHandler): ErrorHandler {
    this.errorHandlers.push(callback);
    return callback;
  }

  async connect(): Promise<void> {
    this.me = await this.get_me();
  }

  async run(): Promise<void> {
    if (this.running) {
      throw new ClientStateError("Bot client is already running");
    }

    this.running = true;
    if (!this.me) {
      await this.connect();
    }

    while (this.running) {
      let updates: BotUpdate[] = [];
      try {
        this.activePollController = new AbortController();
        updates = await this.get_updates({
          offset: this.offset,
          limit: this.pollLimit,
          timeout: this.pollTimeoutSeconds,
          allowed_updates: this.allowedUpdates,
          signal: this.activePollController.signal,
        });
        this.activePollController = undefined;

        for (const update of updates) {
          this.offset = Math.max(this.offset, Number(update.update_id || 0) + 1);
          await this.dispatchUpdate(update);
        }
      } catch (error) {
        this.activePollController = undefined;
        if (!this.running && isAbortError(error)) {
          break;
        }
        await this.dispatchError(error);
        if (!this.running) {
          break;
        }
        await delay(Math.max(this.pollIntervalMs, 1000));
        continue;
      }

      if (this.running && updates.length === 0 && this.pollIntervalMs > 0) {
        await delay(this.pollIntervalMs);
      }
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    this.activePollController?.abort();
    this.activePollController = undefined;
  }

  async process_update(update: BotUpdate): Promise<void> {
    if (typeof update.update_id === "number") {
      this.offset = Math.max(this.offset, update.update_id + 1);
    }
    await this.dispatchUpdate(update);
  }

  async request<T = unknown>(method: string, payload?: UnknownRecord & { signal?: AbortSignal }): Promise<T> {
    const normalizedMethod = String(method || "").trim();
    if (!normalizedMethod) {
      throw new TypeError("Bot API method is required");
    }

    const bodyPayload = { ...(payload ?? {}) };
    const externalSignal = bodyPayload.signal;
    delete bodyPayload.signal;
    const hasMultipart = hasUpload(bodyPayload);
    for (let attempt = 0; ; attempt += 1) {
      const headers = new Headers();
      let body: BodyInit | undefined;

      if (hasMultipart) {
        const form = new FormData();
        for (const [key, value] of Object.entries(bodyPayload)) {
          appendFormValue(form, key, value);
        }
        body = form;
      } else {
        headers.set("content-type", "application/json");
        body = JSON.stringify(bodyPayload);
      }

      const signal = mergeAbortSignals(externalSignal, createTimeoutSignal(this.requestTimeoutMs));

      try {
        const response = await this.fetchImpl(`${this.baseUrl}${normalizedMethod}`, {
          method: "POST",
          headers,
          body,
          signal,
        });
        const rawText = await response.text();
        let parsed: BotApiResponse<T>;

        try {
          parsed = JSON.parse(rawText) as BotApiResponse<T>;
        } catch {
          throw new BaleRpcError(response.status, rawText || `HTTP ${response.status}`, normalizedMethod);
        }

        if (!response.ok || !parsed.ok) {
          const status = Number(parsed.error_code ?? response.status ?? -1);
          const error = new BaleRpcError(
            status,
            String(parsed.description ?? rawText ?? `HTTP ${response.status}`),
            normalizedMethod,
          );
          if (attempt < this.maxRetries && isRetriableStatus(status)) {
            await delay(this.retryBaseDelayMs * (attempt + 1));
            continue;
          }
          throw error;
        }

        return parsed.result;
      } catch (error) {
        if (isAbortError(error) && externalSignal?.aborted) {
          throw error;
        }
        if (attempt < this.maxRetries && (isAbortError(error) || !(error instanceof BaleRpcError))) {
          await delay(this.retryBaseDelayMs * (attempt + 1));
          continue;
        }
        throw error;
      }
    }
  }

  async get_me(): Promise<UnknownRecord> {
    return await this.request("getMe");
  }

  async get_updates(payload: {
    offset?: number;
    limit?: number;
    timeout?: number;
    allowed_updates?: string[];
    signal?: AbortSignal;
  } = {}): Promise<BotUpdate[]> {
    return await this.request<BotUpdate[]>("getUpdates", payload);
  }

  async set_webhook(url: string, options: UnknownRecord = {}): Promise<true> {
    return await this.request("setWebhook", { url, ...options });
  }

  async delete_webhook(drop_pending_updates?: boolean): Promise<true> {
    return await this.request("deleteWebhook", {
      drop_pending_updates: drop_pending_updates ?? false,
    });
  }

  async get_webhook_info(): Promise<UnknownRecord> {
    return await this.request("getWebhookInfo");
  }

  async send_message(chat_id: number | string | UnknownRecord, text: string, options: UnknownRecord = {}) {
    return await this.request("sendMessage", { chat_id, text, ...options });
  }

  async forward_message(
    chat_id: number | string | UnknownRecord,
    from_chat_id: number | string | UnknownRecord,
    message_id: number,
    options: UnknownRecord = {},
  ) {
    return await this.request("forwardMessage", { chat_id, from_chat_id, message_id, ...options });
  }

  async copy_message(
    chat_id: number | string | UnknownRecord,
    from_chat_id: number | string | UnknownRecord,
    message_id: number,
    options: UnknownRecord = {},
  ) {
    return await this.request("copyMessage", { chat_id, from_chat_id, message_id, ...options });
  }

  async send_photo(chat_id: number | string | UnknownRecord, photo: string | BotInputFile, options: UnknownRecord = {}) {
    return await this.request("sendPhoto", { chat_id, photo, ...options });
  }

  async send_document(
    chat_id: number | string | UnknownRecord,
    document: string | BotInputFile,
    options: UnknownRecord = {},
  ) {
    return await this.request("sendDocument", { chat_id, document, ...options });
  }

  async send_video(chat_id: number | string | UnknownRecord, video: string | BotInputFile, options: UnknownRecord = {}) {
    return await this.request("sendVideo", { chat_id, video, ...options });
  }

  async send_animation(
    chat_id: number | string | UnknownRecord,
    animation: string | BotInputFile,
    options: UnknownRecord = {},
  ) {
    return await this.request("sendAnimation", { chat_id, animation, ...options });
  }

  async send_audio(chat_id: number | string | UnknownRecord, audio: string | BotInputFile, options: UnknownRecord = {}) {
    return await this.request("sendAudio", { chat_id, audio, ...options });
  }

  async send_voice(chat_id: number | string | UnknownRecord, voice: string | BotInputFile, options: UnknownRecord = {}) {
    return await this.request("sendVoice", { chat_id, voice, ...options });
  }

  async send_media_group(
    chat_id: number | string | UnknownRecord,
    media: unknown[],
    options: UnknownRecord = {},
  ) {
    return await this.request("sendMediaGroup", { chat_id, media, ...options });
  }

  async send_location(
    chat_id: number | string | UnknownRecord,
    latitude: number,
    longitude: number,
    options: UnknownRecord = {},
  ) {
    return await this.request("sendLocation", { chat_id, latitude, longitude, ...options });
  }

  async send_contact(
    chat_id: number | string | UnknownRecord,
    phone_number: string,
    first_name: string,
    options: UnknownRecord = {},
  ) {
    return await this.request("sendContact", { chat_id, phone_number, first_name, ...options });
  }

  async send_chat_action(chat_id: number | string | UnknownRecord, action: string) {
    return await this.request("sendChatAction", { chat_id, action });
  }

  async edit_message_text(text: string, options: UnknownRecord) {
    return await this.request("editMessageText", { text, ...options });
  }

  async edit_message_caption(options: UnknownRecord) {
    return await this.request("editMessageCaption", options);
  }

  async edit_message_reply_markup(options: UnknownRecord) {
    return await this.request("editMessageReplyMarkup", options);
  }

  async delete_message(chat_id: number | string | UnknownRecord, message_id: number) {
    return await this.request("deleteMessage", { chat_id, message_id });
  }

  async ban_chat_member(chat_id: number | string | UnknownRecord, user_id: number, options: UnknownRecord = {}) {
    return await this.request("banChatMember", { chat_id, user_id, ...options });
  }

  async unban_chat_member(chat_id: number | string | UnknownRecord, user_id: number, options: UnknownRecord = {}) {
    return await this.request("unbanChatMember", { chat_id, user_id, ...options });
  }

  async restrict_chat_member(chat_id: number | string | UnknownRecord, user_id: number, options: UnknownRecord = {}) {
    return await this.request("restrictChatMember", { chat_id, user_id, ...options });
  }

  async promote_chat_member(chat_id: number | string | UnknownRecord, user_id: number, options: UnknownRecord = {}) {
    return await this.request("promoteChatMember", { chat_id, user_id, ...options });
  }

  async set_chat_administrator_custom_title(
    chat_id: number | string | UnknownRecord,
    user_id: number,
    custom_title: string,
  ) {
    return await this.request("setChatAdministratorCustomTitle", { chat_id, user_id, custom_title });
  }

  async set_chat_photo(chat_id: number | string | UnknownRecord, photo: BotInputFile) {
    return await this.request("setChatPhoto", { chat_id, photo });
  }

  async delete_chat_photo(chat_id: number | string | UnknownRecord) {
    return await this.request("deleteChatPhoto", { chat_id });
  }

  async set_chat_title(chat_id: number | string | UnknownRecord, title: string) {
    return await this.request("setChatTitle", { chat_id, title });
  }

  async set_chat_description(chat_id: number | string | UnknownRecord, description: string) {
    return await this.request("setChatDescription", { chat_id, description });
  }

  async pin_chat_message(chat_id: number | string | UnknownRecord, message_id: number, options: UnknownRecord = {}) {
    return await this.request("pinChatMessage", { chat_id, message_id, ...options });
  }

  async unpin_chat_message(chat_id: number | string | UnknownRecord, message_id?: number) {
    return await this.request("unPinChatMessage", { chat_id, message_id });
  }

  async leave_chat(chat_id: number | string | UnknownRecord) {
    return await this.request("leaveChat", { chat_id });
  }

  async get_chat(chat_id: number | string | UnknownRecord) {
    return await this.request("getChat", { chat_id });
  }

  async get_chat_administrators(chat_id: number | string | UnknownRecord) {
    return await this.request("getChatAdministrators", { chat_id });
  }

  async get_chat_members_count(chat_id: number | string | UnknownRecord) {
    return await this.request("getChatMembersCount", { chat_id });
  }

  async get_chat_member(chat_id: number | string | UnknownRecord, user_id: number) {
    return await this.request("getChatMember", { chat_id, user_id });
  }

  async get_file(file_id: string): Promise<BotFile> {
    return await this.request<BotFile>("getFile", { file_id });
  }

  get_file_url(file_path: string): string {
    const normalized = String(file_path || "").replace(/^\/+/, "");
    if (!normalized) {
      throw new TypeError("file_path is required");
    }
    return `${this.baseUrl.replace(/\/$/, "")}/${normalized}`;
  }

  async answer_callback_query(callback_query_id: string, options: UnknownRecord = {}) {
    return await this.request("answerCallbackQuery", { callback_query_id, ...options });
  }

  async ask_review(chat_id: number | string | UnknownRecord) {
    return await this.request("askReview", { chat_id });
  }

  async answer_shipping_query(shipping_query_id: string, ok: boolean, options: UnknownRecord = {}) {
    return await this.request("answerShippingQuery", { shipping_query_id, ok, ...options });
  }

  async answer_pre_checkout_query(pre_checkout_query_id: string, ok: boolean, options: UnknownRecord = {}) {
    return await this.request("answerPreCheckoutQuery", { pre_checkout_query_id, ok, ...options });
  }

  async send_invoice(chat_id: number | string | UnknownRecord, options: BotInvoiceOptions) {
    return await this.request("sendInvoice", { chat_id, ...normalizeProviderToken(options) });
  }

  async create_invoice_link(options: CreateInvoiceLinkOptions) {
    return await this.request("createInvoiceLink", normalizeProviderToken(options));
  }

  async inquire_transaction(order_id: string) {
    return await this.request("inquireTransaction", { order_id });
  }

  async export_chat_invite_link(chat_id: number | string | UnknownRecord) {
    return await this.request("exportChatInviteLink", { chat_id });
  }

  async create_chat_invite_link(chat_id: number | string | UnknownRecord, options: UnknownRecord = {}) {
    return await this.request("createChatInviteLink", { chat_id, ...options });
  }

  async revoke_chat_invite_link(chat_id: number | string | UnknownRecord, invite_link: string) {
    return await this.request("revokeChatInviteLink", { chat_id, invite_link });
  }

  async unpin_all_chat_messages(chat_id: number | string | UnknownRecord) {
    return await this.request("unpinAllChatMessages", { chat_id });
  }

  async upload_sticker_file(user_id: number, sticker: BotInputFile, sticker_format: string) {
    return await this.request("uploadStickerFile", { user_id, sticker, sticker_format });
  }

  async create_new_sticker_set(user_id: number, name: string, title: string, stickers: unknown[], options: UnknownRecord = {}) {
    return await this.request("createNewStickerSet", { user_id, name, title, stickers, ...options });
  }

  async add_sticker_to_set(user_id: number, name: string, sticker: unknown) {
    return await this.request("addStickerToSet", { user_id, name, sticker });
  }

  private async dispatchUpdate(update: BotUpdate): Promise<void> {
    for (const handler of this.updateHandlers) {
      await this.runHandler(() => handler(update, this));
    }

    if (update.message && isPlainObject(update.message)) {
      for (const handler of this.messageHandlers) {
        await this.runHandler(() => handler(update.message as BotMessage, this));
      }
      await this.dispatchMessageSubtypes(update.message as BotMessage);
      await this.dispatchSuccessfulPayment(update.message as BotMessage);
    }

    if (update.edited_message && isPlainObject(update.edited_message)) {
      for (const handler of this.editedMessageHandlers) {
        await this.runHandler(() => handler(update.edited_message as BotMessage, this));
      }
      await this.dispatchMessageSubtypes(update.edited_message as BotMessage);
      await this.dispatchSuccessfulPayment(update.edited_message as BotMessage);
    }

    if (update.channel_post && isPlainObject(update.channel_post)) {
      for (const handler of this.channelPostHandlers) {
        await this.runHandler(() => handler(update.channel_post as BotMessage, this));
      }
      await this.dispatchMessageSubtypes(update.channel_post as BotMessage);
      await this.dispatchSuccessfulPayment(update.channel_post as BotMessage);
    }

    if (update.edited_channel_post && isPlainObject(update.edited_channel_post)) {
      for (const handler of this.editedChannelPostHandlers) {
        await this.runHandler(() => handler(update.edited_channel_post as BotMessage, this));
      }
      await this.dispatchMessageSubtypes(update.edited_channel_post as BotMessage);
      await this.dispatchSuccessfulPayment(update.edited_channel_post as BotMessage);
    }

    if (update.callback_query && isPlainObject(update.callback_query)) {
      for (const handler of this.callbackQueryHandlers) {
        await this.runHandler(() => handler(update.callback_query as BotCallbackQuery, this));
      }
    }

    if (update.shipping_query && isPlainObject(update.shipping_query)) {
      for (const handler of this.shippingQueryHandlers) {
        await this.runHandler(() => handler(update.shipping_query as BotShippingQuery, this));
      }
    }

    if (update.pre_checkout_query && isPlainObject(update.pre_checkout_query)) {
      for (const handler of this.preCheckoutQueryHandlers) {
        await this.runHandler(() => handler(update.pre_checkout_query as BotPreCheckoutQuery, this));
      }
    }

    if (update.poll && isPlainObject(update.poll)) {
      for (const handler of this.pollHandlers) {
        await this.runHandler(() => handler(update.poll as UnknownRecord, this));
      }
    }

    if (update.poll_answer && isPlainObject(update.poll_answer)) {
      for (const handler of this.pollAnswerHandlers) {
        await this.runHandler(() => handler(update.poll_answer as UnknownRecord, this));
      }
    }
  }

  private async dispatchMessageSubtypes(message: BotMessage): Promise<void> {
    if (typeof message.text === "string") {
      for (const handler of this.textHandlers) {
        await this.runHandler(() => handler(message, this));
      }
    }

    if (hasArrayItems(message.photo)) {
      for (const handler of this.photoHandlers) {
        await this.runHandler(() => handler(message, this));
      }
    }

    if (isPlainObject(message.audio)) {
      for (const handler of this.audioHandlers) {
        await this.runHandler(() => handler(message, this));
      }
    }

    if (isPlainObject(message.document)) {
      for (const handler of this.documentHandlers) {
        await this.runHandler(() => handler(message, this));
      }
    }

    if (isPlainObject(message.video)) {
      for (const handler of this.videoHandlers) {
        await this.runHandler(() => handler(message, this));
      }
    }

    if (isPlainObject(message.animation)) {
      for (const handler of this.animationHandlers) {
        await this.runHandler(() => handler(message, this));
      }
    }

    if (isPlainObject(message.voice)) {
      for (const handler of this.voiceHandlers) {
        await this.runHandler(() => handler(message, this));
      }
    }

    if (isPlainObject(message.sticker)) {
      for (const handler of this.stickerHandlers) {
        await this.runHandler(() => handler(message, this));
      }
    }

    if (isPlainObject(message.contact)) {
      for (const handler of this.contactHandlers) {
        await this.runHandler(() => handler(message, this));
      }
    }

    if (isPlainObject(message.location)) {
      for (const handler of this.locationHandlers) {
        await this.runHandler(() => handler(message, this));
      }
    }

    if (isPlainObject(message.invoice)) {
      for (const handler of this.invoiceHandlers) {
        await this.runHandler(() => handler(message, this));
      }
    }

    if (isPlainObject(message.web_app_data)) {
      for (const handler of this.webAppDataHandlers) {
        await this.runHandler(() => handler(message, this));
      }
    }

    if (hasArrayItems(message.new_chat_members)) {
      for (const handler of this.newChatMembersHandlers) {
        await this.runHandler(() => handler(message, this));
      }
    }

    if (isPlainObject(message.left_chat_member)) {
      for (const handler of this.leftChatMemberHandlers) {
        await this.runHandler(() => handler(message, this));
      }
    }
  }

  private async dispatchSuccessfulPayment(message: BotMessage): Promise<void> {
    if (!isPlainObject(message.successful_payment)) {
      return;
    }

    const payment = {
      ...message.successful_payment,
      message,
    } satisfies BotSuccessfulPayment & { message: BotMessage };

    for (const handler of this.successfulPaymentHandlers) {
      await this.runHandler(() => handler(payment, this));
    }
  }

  private async runHandler(callback: () => unknown | Promise<unknown>): Promise<void> {
    try {
      await callback();
    } catch (error) {
      await this.dispatchError(error);
    }
  }

  private async dispatchError(error: unknown): Promise<void> {
    if (this.errorHandlers.length === 0) {
      throw error;
    }

    for (const handler of this.errorHandlers) {
      await handler(error, this);
    }
  }
}
