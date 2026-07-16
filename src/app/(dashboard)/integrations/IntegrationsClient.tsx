"use client";

import { useState } from "react";
import {
  Check, X, AlertCircle, Database, Mail, Globe, Github, Phone, Radio, LucideIcon,
} from "lucide-react";
import { saveIntegrationAction, disconnectIntegrationAction } from "./actions";

/* ------------------------------------------------------------------ */
/* Provider registry                                                   */
/* ------------------------------------------------------------------ */

interface IntegrationConfig {
  id: string;
  type: "LEAD_PROVIDER" | "EMAIL_PROVIDER" | "AUTOMATION" | "CRM" | "VOICE";
  name: string;
  provider: string;
  description: string;
  icon: LucideIcon;
  color: string;
  isBuiltIn: boolean;
  formKind: "api-key" | "github" | "ghl" | "callfluent";
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
    formKind: "api-key",
  },
  {
    id: "email-mock",
    type: "EMAIL_PROVIDER",
    name: "Mock Email Provider",
    provider: "mock-email",
    description: "Built-in mock email provider for development",
    icon: Mail,
    color: "bg-blue-50 text-blue-600",
    isBuiltIn: true,
    formKind: "api-key",
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
    formKind: "api-key",
  },
  {
    id: "gemini",
    type: "LEAD_PROVIDER",
    name: "Google Gemini AI",
    provider: "gemini",
    description: "Advanced AI email discovery using Google Search grounding",
    icon: Database,
    color: "bg-purple-50 text-purple-600",
    isBuiltIn: false,
    formKind: "api-key",
  },
  {
    id: "openai",
    type: "LEAD_PROVIDER",
    name: "OpenAI GPT (Fallback)",
    provider: "openai",
    description: "GPT-4o-mini fallback when Gemini can't find an email",
    icon: Database,
    color: "bg-emerald-50 text-emerald-600",
    isBuiltIn: false,
    formKind: "api-key",
  },
  {
    id: "github",
    type: "AUTOMATION",
    name: "GitHub Automation",
    provider: "github",
    description:
      "Fires repository_dispatch events to your Workflow-Automation repo",
    icon: Github,
    color: "bg-slate-100 text-slate-800",
    isBuiltIn: false,
    formKind: "github",
  },
  {
    id: "ghl",
    type: "CRM",
    name: "GoHighLevel CRM",
    provider: "ghl",
    description: "Sync leads into your GHL sub-account via location tokens",
    icon: Radio,
    color: "bg-amber-50 text-amber-700",
    isBuiltIn: false,
    formKind: "ghl",
  },
  {
    id: "callfluent",
    type: "VOICE",
    name: "Callfluent AI Voice",
    provider: "callfluent",
    description: "AI-powered outbound voice with post-call webhook ingestion",
    icon: Phone,
    color: "bg-rose-50 text-rose-700",
    isBuiltIn: false,
    formKind: "callfluent",
  },
];

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface IntegrationsClientProps {
  existingIntegrations: Array<{
    provider: string;
    isActive: boolean;
  }>;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<string, string> = {
  LEAD_PROVIDER: "Lead Providers",
  EMAIL_PROVIDER: "Email Providers",
  AUTOMATION: "Automation Bridges",
  CRM: "CRM Connectors",
  VOICE: "Voice AI",
};

export default function IntegrationsClient({
  existingIntegrations,
}: IntegrationsClientProps) {
  const [selected, setSelected] = useState<IntegrationConfig | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const getStatus = (provider: string) =>
    existingIntegrations.find((i) => i.provider === provider);

  const handleConnectClick = (integration: IntegrationConfig) => {
    const existing = getStatus(integration.provider);
    if (existing?.isActive) {
      handleDisconnect(integration.provider);
      return;
    }
    setSelected(integration);
    setForm({});
    setBanner(null);
  };

  const handleDisconnect = async (provider: string) => {
    if (!confirm("Disconnect this integration?")) return;
    try {
      await disconnectIntegrationAction(provider);
      setBanner({ kind: "ok", text: `Disconnected ${provider}.` });
    } catch (err) {
      console.error(err);
      setBanner({ kind: "err", text: "Failed to disconnect." });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;

    setSaving(true);
    setBanner(null);

    try {
      // For the simple api-key case use the existing server action.
      if (selected.formKind === "api-key") {
        const apiKey = form.apiKey?.trim();
        if (!apiKey) {
          setBanner({ kind: "err", text: "API key is required." });
          return;
        }
        const type =
          selected.type === "EMAIL_PROVIDER"
            ? "EMAIL_PROVIDER"
            : "LEAD_PROVIDER";
        const res = await saveIntegrationAction(
          type,
          selected.name,
          selected.provider,
          apiKey,
          true
        );
        if (!res.success) {
          throw new Error(res.error || "Failed to save integration");
        }
      } else {
        // Rich-form providers go through the new API route which encrypts secrets.
        const res = await fetch("/api/integrations/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: selected.provider,
            name: selected.name,
            isActive: true,
            ...form,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }
      }

      setBanner({ kind: "ok", text: `${selected.name} connected.` });
      setSelected(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      console.error(err);
      setBanner({ kind: "err", text: msg });
    } finally {
      setSaving(false);
    }
  };

  const grouped = availableIntegrations.reduce<Record<string, IntegrationConfig[]>>(
    (acc, i) => {
      (acc[i.type] ||= []).push(i);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6" data-testid="integrations-page">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-500 text-sm">
          Connect your lead providers, automation bridges, CRM, and voice AI services
        </p>
      </div>

      {banner && (
        <div
          className={`p-3 rounded-lg text-sm border ${
            banner.kind === "ok"
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
          data-testid="integrations-banner"
        >
          {banner.text}
        </div>
      )}

      {Object.entries(grouped).map(([type, list]) => (
        <div key={type}>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">
            {CATEGORY_LABELS[type] || type}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((integration) => {
              const existing = getStatus(integration.provider);
              const isActive = integration.isBuiltIn || existing?.isActive;
              return (
                <div
                  key={integration.id}
                  className="card p-5"
                  data-testid={`integration-card-${integration.provider}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${integration.color}`}
                    >
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
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {integration.name}
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    {integration.description}
                  </p>
                  {!integration.isBuiltIn && (
                    <button
                      onClick={() => handleConnectClick(integration)}
                      data-testid={`integration-connect-${integration.provider}`}
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

      <div className="card p-5 border-amber-200 bg-amber-50">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900 mb-1">
              Secrets are encrypted at rest
            </h3>
            <p className="text-sm text-amber-700">
              GitHub PATs, GHL tokens, Callfluent keys and provider API keys are
              stored using AES-256-GCM encryption keyed on{" "}
              <code className="bg-amber-100 px-1 rounded">ENCRYPTION_SECRET</code>.
              The plaintext values are never returned by the API once saved.
            </p>
          </div>
        </div>
      </div>

      {/* Connection Modal */}
      {selected && (
        <div
          className="modal-overlay"
          onClick={() => setSelected(null)}
          data-testid="integration-modal"
        >
          <div
            className="modal max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${selected.color}`}
              >
                <selected.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  Connect {selected.name}
                </h3>
                <p className="text-xs text-gray-500">
                  {selected.formKind === "api-key" && "Enter your API key"}
                  {selected.formKind === "github" &&
                    "Configure GitHub repo + PAT"}
                  {selected.formKind === "ghl" && "Paste your GHL tokens"}
                  {selected.formKind === "callfluent" &&
                    "Enter your Callfluent API key"}
                </p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {selected.formKind === "api-key" && (
                <div>
                  <label className="form-label">API Key *</label>
                  <input
                    type="password"
                    value={form.apiKey || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, apiKey: e.target.value }))
                    }
                    className="form-input"
                    placeholder="Paste your API key here"
                    data-testid="integration-form-apikey"
                    required
                  />
                </div>
              )}

              {selected.formKind === "github" && (
                <>
                  <div>
                    <label className="form-label">GitHub Personal Access Token *</label>
                    <input
                      type="password"
                      value={form.githubToken || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, githubToken: e.target.value }))
                      }
                      className="form-input"
                      placeholder="ghp_… (needs repo scope)"
                      data-testid="integration-form-github-token"
                      required
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Use <code>MOCK_TOKEN</code> to smoke-test without a live dispatch.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Repo Owner</label>
                      <input
                        type="text"
                        value={form.githubRepoOwner || "robointelai-dotcom"}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            githubRepoOwner: e.target.value,
                          }))
                        }
                        className="form-input"
                        data-testid="integration-form-github-owner"
                      />
                    </div>
                    <div>
                      <label className="form-label">Repo Name</label>
                      <input
                        type="text"
                        value={form.githubRepoName || "Workflow-Automation-"}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            githubRepoName: e.target.value,
                          }))
                        }
                        className="form-input"
                        data-testid="integration-form-github-repo"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Target Branch</label>
                    <input
                      type="text"
                      value={form.githubTargetBranch || "main"}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          githubTargetBranch: e.target.value,
                        }))
                      }
                      className="form-input"
                      data-testid="integration-form-github-branch"
                    />
                  </div>
                </>
              )}

              {selected.formKind === "ghl" && (
                <>
                  <div>
                    <label className="form-label">Access Token *</label>
                    <input
                      type="password"
                      value={form.ghlAccessToken || ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          ghlAccessToken: e.target.value,
                        }))
                      }
                      className="form-input"
                      placeholder="GHL access token"
                      data-testid="integration-form-ghl-access"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Refresh Token</label>
                    <input
                      type="password"
                      value={form.ghlRefreshToken || ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          ghlRefreshToken: e.target.value,
                        }))
                      }
                      className="form-input"
                      placeholder="GHL refresh token"
                      data-testid="integration-form-ghl-refresh"
                    />
                  </div>
                  <div>
                    <label className="form-label">Location ID *</label>
                    <input
                      type="text"
                      value={form.ghlLocationId || ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          ghlLocationId: e.target.value,
                        }))
                      }
                      className="form-input"
                      placeholder="e.g. lctn_abc123"
                      data-testid="integration-form-ghl-location"
                      required
                    />
                  </div>
                </>
              )}

              {selected.formKind === "callfluent" && (
                <div>
                  <label className="form-label">Callfluent API Key *</label>
                  <input
                    type="password"
                    value={form.callfluentApiKey || ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        callfluentApiKey: e.target.value,
                      }))
                    }
                    className="form-input"
                    placeholder="Callfluent API key"
                    data-testid="integration-form-callfluent-key"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Post-call webhooks: <code>/api/webhooks/callfluent</code>
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  data-testid="integration-form-submit"
                  className="btn-primary w-full justify-center"
                >
                  {saving ? "Connecting..." : "Connect Provider"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
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
