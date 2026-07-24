/**
 * Provider-agnostic Email Provider Interface
 */

export interface SendEmailOptions {
  to: string;
  from?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  metadata?: Record<string, string>;
}

export interface BatchSendOptions {
  messages: SendEmailOptions[];
  delayBetweenMs?: number;
}

export interface EmailSendResult {
  messageId: string;
  status: "sent" | "failed";
  error?: string;
}

export interface DeliveryStatus {
  messageId: string;
  status: "sent" | "delivered" | "opened" | "clicked" | "bounced" | "failed" | "unsubscribed";
  timestamp?: Date;
}

export interface EmailUsage {
  used: number;
  limit: number;
  remaining: number;
}

export interface EmailProvider {
  name: string;
  sendEmail(options: SendEmailOptions): Promise<EmailSendResult>;
  sendBatch(options: BatchSendOptions): Promise<EmailSendResult[]>;
  getDeliveryStatus(messageId: string): Promise<DeliveryStatus | null>;
  verifyWebhook(payload: unknown, signature: string): boolean;
  getUsage(): Promise<EmailUsage>;
}

// ─── Mock Email Provider (Development) ───────────────────────────────────────

export class MockEmailProvider implements EmailProvider {
  name = "mock";

  private log: Array<{ to: string; subject: string; sentAt: Date }> = [];

  async sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
    await new Promise((r) => setTimeout(r, 50));
    const messageId = `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    this.log.push({ to: options.to, subject: options.subject, sentAt: new Date() });
    console.log(`[MockEmail] Sent to ${options.to}: ${options.subject}`);

    return { messageId, status: "sent" };
  }

  async sendBatch(options: BatchSendOptions): Promise<EmailSendResult[]> {
    const results: EmailSendResult[] = [];
    for (const msg of options.messages) {
      if (options.delayBetweenMs) {
        await new Promise((r) => setTimeout(r, options.delayBetweenMs));
      }
      results.push(await this.sendEmail(msg));
    }
    return results;
  }

  async getDeliveryStatus(messageId: string): Promise<DeliveryStatus | null> {
    return {
      messageId,
      status: "delivered",
      timestamp: new Date(),
    };
  }

  verifyWebhook(_payload: unknown, _signature: string): boolean {
    return true;
  }

  async getUsage(): Promise<EmailUsage> {
    return { used: this.log.length, limit: 500, remaining: 500 - this.log.length };
  }
}

export class GMassProvider implements EmailProvider {
  name = "gmass";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
    const url = "https://api.gmass.co/api/transactional";
    
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-apikey": this.apiKey,
        },
        body: JSON.stringify({
          to: options.to,
          subject: options.subject,
          html: options.html,
          from: options.from,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { messageId: "", status: "failed", error: `GMass Error: ${res.status} ${errText}` };
      }

      const data = await res.json();
      return { messageId: data.id || data.messageId || `gmass-${Date.now()}`, status: "sent" };
    } catch (err) {
      return { messageId: "", status: "failed", error: err instanceof Error ? err.message : String(err) };
    }
  }

  async sendBatch(options: BatchSendOptions): Promise<EmailSendResult[]> {
    const results: EmailSendResult[] = [];
    for (const msg of options.messages) {
      if (options.delayBetweenMs) {
        await new Promise((r) => setTimeout(r, options.delayBetweenMs));
      }
      results.push(await this.sendEmail(msg));
    }
    return results;
  }

  async getDeliveryStatus(messageId: string): Promise<DeliveryStatus | null> {
    return {
      messageId,
      status: "delivered",
      timestamp: new Date(),
    };
  }

  verifyWebhook(_payload: unknown, _signature: string): boolean {
    return true;
  }

  async getUsage(): Promise<EmailUsage> {
    return { used: 0, limit: 10000, remaining: 10000 };
  }
}

// ─── Provider Factory ─────────────────────────────────────────────────────────

let _emailProvider: EmailProvider | null = null;

export function getEmailProvider(apiKey?: string): EmailProvider {
  if (_emailProvider) return _emailProvider;
  const providerName = process.env.EMAIL_PROVIDER || "mock";
  if (providerName === "gmass" && apiKey) {
    _emailProvider = new GMassProvider(apiKey);
  } else {
    _emailProvider = new MockEmailProvider();
  }
  return _emailProvider;
}

// ─── Personalization Variables ─────────────────────────────────────────────────

export const PERSONALIZATION_VARIABLES = [
  "{{business_name}}",
  "{{contact_name}}",
  "{{city}}",
  "{{state}}",
  "{{country}}",
  "{{category}}",
  "{{website}}",
  "{{phone}}",
  "{{sender_name}}",
  "{{company_name}}",
] as const;

export type PersonalizationVariable = (typeof PERSONALIZATION_VARIABLES)[number];

export interface PersonalizationData {
  business_name?: string;
  contact_name?: string;
  city?: string;
  state?: string;
  country?: string;
  category?: string;
  website?: string;
  phone?: string;
  sender_name?: string;
  company_name?: string;
}

export function applyPersonalization(
  template: string,
  data: PersonalizationData
): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replaceAll(`{{${key}}}`, value || "");
  }
  return result;
}
