"use client";

import { useState } from "react";
import { Check, X, AlertCircle, Database, Mail, Globe, LucideIcon } from "lucide-react";
import { saveIntegrationAction, disconnectIntegrationAction } from "./actions";

interface IntegrationConfig {
  id: string;
  type: "LEAD_PROVIDER" | "EMAIL_PROVIDER";
  name: string;
  provider: string;
  description: string;
  icon: LucideIcon;
  color: string;
  isBuiltIn: boolean;
}

const availableIntegrations: IntegrationConfig[] = [
  {
    id: "lead-mock",
    type: "LEAD_PROVIDER",
    name: "Mock Lead Provider",
    provider: "mock",
    description: "Built-in mock provider for development and testing",
    icon: Database,
    color: "bg-gray-50 text-gray-600",
    isBuiltIn: true,
  },
  {
    id: "email-mock",
    type: "EMAIL_PROVIDER",
    name: "Mock Email Provider",
    provider: "mock",
    description: "Built-in mock email provider for development",
    icon: Mail,
    color: "bg-blue-50 text-blue-600",
    isBuiltIn: true,
  },
  {
    id: "sendgrid",
    type: "EMAIL_PROVIDER",
    name: "SendGrid",
    provider: "sendgrid",
    description: "Professional email delivery with high deliverability",
    icon: Mail,
    color: "bg-blue-50 text-blue-600",
    isBuiltIn: false,
  },
  {
    id: "mailgun",
    type: "EMAIL_PROVIDER",
    name: "Mailgun",
    provider: "mailgun",
    description: "Transactional email API for developers",
    icon: Mail,
    color: "bg-red-50 text-red-600",
    isBuiltIn: false,
  },
  {
    id: "resend",
    type: "EMAIL_PROVIDER",
    name: "Resend",
    provider: "resend",
    description: "Modern email API with beautiful developer experience",
    icon: Mail,
    color: "bg-amber-50 text-amber-600",
    isBuiltIn: false,
  },
  {
    id: "google-places",
    type: "LEAD_PROVIDER",
    name: "Google Places API",
    provider: "google-places",
    description: "Find businesses using Google Maps data",
    icon: Globe,
    color: "bg-green-50 text-green-600",
    isBuiltIn: false,
  },
  {
    id: "gemini",
    type: "LEAD_PROVIDER",
    name: "Google Gemini AI",
    provider: "gemini",
    description: "Advanced AI to discover hidden contact information using Google Search grounding",
    icon: Database,
    color: "bg-purple-50 text-purple-600",
    isBuiltIn: false,
  },
  {
    id: "openai",
    type: "LEAD_PROVIDER",
    name: "OpenAI GPT (Fallback)",
    provider: "openai",
    description: "GPT-4o-mini fallback: used automatically when Gemini cannot find an email",
    icon: Database,
    color: "bg-emerald-50 text-emerald-600",
    isBuiltIn: false,
  },
];

interface IntegrationsClientProps {
  existingIntegrations: Array<{
    provider: string;
    isActive: boolean;
  }>;
}

export default function IntegrationsClient({ existingIntegrations }: IntegrationsClientProps) {
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationConfig | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const getIntegrationStatus = (provider: string) => {
    return existingIntegrations.find((i) => i.provider === provider);
  };

  const handleConnectClick = (integration: IntegrationConfig) => {
    const existing = getIntegrationStatus(integration.provider);
    if (existing?.isActive) {
      handleDisconnect(integration.provider);
    } else {
      setSelectedIntegration(integration);
      setApiKey("");
    }
  };

  const handleDisconnect = async (provider: string) => {
    if (confirm("Are you sure you want to disconnect this integration?")) {
      await disconnectIntegrationAction(provider);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIntegration || !apiKey.trim()) return;

    setIsSaving(true);
    try {
      await saveIntegrationAction(
        selectedIntegration.type,
        selectedIntegration.name,
        selectedIntegration.provider,
        apiKey.trim(),
        true
      );
      setSelectedIntegration(null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-500 text-sm">Connect your lead providers and email services</p>
      </div>

      <div className="space-y-6">
        {["LEAD_PROVIDER", "EMAIL_PROVIDER"].map((type) => (
          <div key={type}>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">
              {type === "LEAD_PROVIDER" ? "Lead Providers" : "Email Providers"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableIntegrations
                .filter((i) => i.type === type)
                .map((integration) => {
                  const existing = getIntegrationStatus(integration.provider);
                  const isActive = integration.isBuiltIn || existing?.isActive;
                  return (
                    <div key={integration.id} className="card p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${integration.color}`}>
                          <integration.icon className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-2">
                          {integration.isBuiltIn && (
                            <span className="badge badge-green text-xs">Built-in</span>
                          )}
                          {isActive ? (
                            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                              <Check className="w-3.5 h-3.5" /> Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <X className="w-3.5 h-3.5" /> Not Connected
                            </span>
                          )}
                        </div>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1">{integration.name}</h3>
                      <p className="text-xs text-gray-500 mb-4">{integration.description}</p>
                      {!integration.isBuiltIn && (
                        <button
                          onClick={() => handleConnectClick(integration)}
                          className={`w-full text-sm py-2 rounded-lg font-medium transition-colors ${
                            isActive
                              ? "bg-red-50 text-red-600 hover:bg-red-100"
                              : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                          }`}
                        >
                          {isActive ? "Disconnect" : "Connect"}
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5 border-amber-200 bg-amber-50">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900 mb-1">Adding Real Providers</h3>
            <p className="text-sm text-amber-700">
              LeadFlow Pro uses a provider-agnostic architecture. To add a real lead provider or email service, implement the <code className="bg-amber-100 px-1 rounded">LeadProvider</code> or <code className="bg-amber-100 px-1 rounded">EmailProvider</code> interface in <code className="bg-amber-100 px-1 rounded">src/lib/lead-provider.ts</code> or <code className="bg-amber-100 px-1 rounded">src/lib/email-provider.ts</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Connection Modal */}
      {selectedIntegration && (
        <div className="modal-overlay" onClick={() => setSelectedIntegration(null)}>
          <div className="modal max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedIntegration.color}`}>
                <selectedIntegration.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Connect {selectedIntegration.name}</h3>
                <p className="text-xs text-gray-500">Enter your API credentials</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="form-label">API Key *</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="form-input"
                  placeholder="Paste your API key here"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving || !apiKey.trim()}
                  className="btn-primary w-full justify-center"
                >
                  {isSaving ? "Connecting..." : "Connect Provider"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIntegration(null)}
                  className="btn-secondary w-full justify-center"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
