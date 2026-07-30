export interface EmailAttachment {
  filename: string;
  contentType: string;
  contentBase64: string;
}

export interface SendTransactionalEmailInput {
  to: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  metadata?: Record<string, string>;
}

export type EmailSendResult =
  | {
      success: true;
      provider: "gmass";
      messageId: string;
      acceptedAt: Date;
      rawStatus?: string;
    }
  | {
      success: false;
      provider: "gmass";
      retryable: boolean;
      errorCode?: string;
      errorMessage: string;
      httpStatus?: number;
    };

export class GMassClient {
  private apiKey: string;
  private endpoint = "https://api.gmass.co/api/transactional";

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("GMassClient requires an API key");
    this.apiKey = apiKey;
  }

  async sendEmail(input: SendTransactionalEmailInput): Promise<EmailSendResult> {
    try {
      const payload: Record<string, any> = {
        to: input.to,
        fromEmail: input.fromEmail, // GMass expects fromEmail and fromName
        fromName: input.fromName,
        subject: input.subject,
        message: input.html, // GMass expects the html/text body to be in the 'message' field
      };

      if (input.text) payload.text = input.text;
      if (input.replyTo) payload.replyTo = input.replyTo;
      
      // Note: GMass doesn't officially document file attachments in the standard transactional 
      // payload, so we use secure PDF URLs by default in the system, but we include it here just in case.
      // We'll omit it for now if they didn't explicitly request a specific format.

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-apikey": this.apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        const isRetryable = res.status === 429 || res.status >= 500;
        
        console.error(`[GMass] HTTP ${res.status}: ${errorText}`);

        return {
          success: false,
          provider: "gmass",
          retryable: isRetryable,
          httpStatus: res.status,
          errorMessage: `GMass rejected request with HTTP ${res.status}`,
          errorCode: `HTTP_${res.status}`,
        };
      }

      const data = await res.json().catch(() => ({}));

      // According to GMass docs, success returns id or messageId
      const messageId = data.id || data.messageId || null;

      if (!messageId) {
        console.error("[GMass] Unexpected success response format:", data);
        return {
          success: false,
          provider: "gmass",
          retryable: false,
          errorMessage: "Provider returned 2xx but no message ID was found in response.",
        };
      }

      return {
        success: true,
        provider: "gmass",
        messageId,
        acceptedAt: new Date(),
        rawStatus: data.status,
      };
    } catch (err: any) {
      console.error("[GMass] Fetch error:", err);
      const isTimeout = err.name === "AbortError" || err.message?.includes("timeout");
      
      return {
        success: false,
        provider: "gmass",
        retryable: true, // Network failures are typically retryable
        errorMessage: err.message || "Network failure connecting to GMass",
        errorCode: isTimeout ? "TIMEOUT" : "NETWORK_ERROR",
      };
    }
  }
}
