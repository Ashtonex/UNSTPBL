export interface SmsSendRequest {
  /** Recipient in E.164 form, e.g. +263771234567. */
  to: string;
  body: string;
}

export interface SmsSendResult {
  /** The provider's id for the message, used to match delivery receipts. */
  providerMessageId: string | null;
  /** 'dry_run' means nothing was actually sent. */
  status: 'sent' | 'dry_run';
}

export interface SmsProvider {
  readonly name: string;
  /** False for the dry-run provider: messages are logged, never delivered. */
  readonly live: boolean;
  send(request: SmsSendRequest): Promise<SmsSendResult>;
}

/** The provider rejected or failed the send. `retryable` is true for transient failures. */
export class SmsProviderError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'SmsProviderError';
  }
}

/** SMS is misconfigured (unknown provider, missing credentials). Fix the environment, not the request. */
export class SmsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SmsConfigError';
  }
}
