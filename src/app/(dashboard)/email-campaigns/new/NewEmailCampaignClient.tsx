"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Clock, Send, Eye } from "lucide-react";
import { PERSONALIZATION_VARIABLES } from "@/lib/email-provider";

interface Campaign { id: string; name: string; }
interface Template { id: string; name: string; subject: string; htmlContent: string; }

interface Props {
  campaigns: Campaign[];
  templates: Template[];
  defaultCampaignId?: string;
}

export default function NewEmailCampaignClient({ campaigns, templates, defaultCampaignId }: Props) {
  const router = useRouter();
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [name, setName] = useState("");
  const [campaignId, setCampaignId] = useState(defaultCampaignId || "");
  const [sendMode, setSendMode] = useState<"immediate" | "scheduled">("immediate");
  const [scheduledAt, setScheduledAt] = useState("");
  const [sendingLimit, setSendingLimit] = useState(50);
  const [delayBetweenMs, setDelayBetweenMs] = useState(1000);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleTemplateChange = (templateId: string) => {
    const tmpl = templates.find((t) => t.id === templateId) || null;
    setSelectedTemplate(tmpl);
    if (tmpl) {
      setSubject(tmpl.subject);
      setHtmlContent(tmpl.htmlContent);
    }
  };

  const insertVariable = (v: string) => {
    setHtmlContent((prev) => prev + v);
  };

  const handleSave = async () => {
    if (!name || !subject || !htmlContent) {
      alert("Please fill in the campaign name, subject, and content.");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/email-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, campaignId, templateId: selectedTemplate?.id, subject, htmlContent, sendMode, scheduledAt, sendingLimit, delayBetweenMs }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/email-campaigns/${data.id}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-5">Campaign Setup</h2>
        <div className="space-y-4">
          <div>
            <label className="form-label">Campaign Name *</label>
            <input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. NYC Restaurant Outreach - June" />
          </div>
          <div>
            <label className="form-label">Lead Campaign (optional)</label>
            <select className="form-input" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">No campaign (use all leads)</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Email Template</label>
            <select className="form-input" onChange={(e) => handleTemplateChange(e.target.value)}>
              <option value="">Start from scratch</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-5">Email Content</h2>
        <div className="space-y-4">
          <div>
            <label className="form-label">Subject Line *</label>
            <input type="text" className="form-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Quick question about {{business_name}}" />
          </div>
          <div>
            <label className="form-label">Personalization Variables</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PERSONALIZATION_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="badge badge-amber cursor-pointer hover:bg-amber-200 transition-colors text-xs"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="form-label mb-0">Email Body (HTML) *</label>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="btn-ghost text-xs py-1 px-2"
              >
                <Eye className="w-3.5 h-3.5" /> {showPreview ? "Edit" : "Preview"}
              </button>
            </div>
            {showPreview ? (
              <div
                className="border border-gray-200 rounded-xl p-4 min-h-[200px] prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            ) : (
              <textarea
                rows={10}
                className="form-input font-mono text-xs"
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                placeholder="<p>Hi {{contact_name}},</p><p>Your message here...</p>"
              />
            )}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-5">Sending Options</h2>
        <div className="space-y-4">
          <div>
            <label className="form-label">Send Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors ${sendMode === "immediate" ? "border-amber-400 bg-amber-50" : "border-gray-200"}`}>
                <input type="radio" name="sendMode" value="immediate" checked={sendMode === "immediate"} onChange={() => setSendMode("immediate")} className="accent-amber-500" />
                <div>
                  <Send className="w-4 h-4 text-amber-500 mb-1" />
                  <p className="text-sm font-medium">Send Now</p>
                  <p className="text-xs text-gray-400">Start sending immediately</p>
                </div>
              </label>
              <label className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors ${sendMode === "scheduled" ? "border-amber-400 bg-amber-50" : "border-gray-200"}`}>
                <input type="radio" name="sendMode" value="scheduled" checked={sendMode === "scheduled"} onChange={() => setSendMode("scheduled")} className="accent-amber-500" />
                <div>
                  <Clock className="w-4 h-4 text-blue-500 mb-1" />
                  <p className="text-sm font-medium">Schedule</p>
                  <p className="text-xs text-gray-400">Choose a future time</p>
                </div>
              </label>
            </div>
          </div>

          {sendMode === "scheduled" && (
            <div>
              <label className="form-label">Schedule Date & Time</label>
              <input type="datetime-local" className="form-input" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Sending Limit (per batch)</label>
              <input type="number" className="form-input" value={sendingLimit} onChange={(e) => setSendingLimit(Number(e.target.value))} min={1} max={1000} />
            </div>
            <div>
              <label className="form-label">Delay Between Messages (ms)</label>
              <input type="number" className="form-input" value={delayBetweenMs} onChange={(e) => setDelayBetweenMs(Number(e.target.value))} min={0} max={60000} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={handleSave} disabled={isSaving} className="btn-primary">
          <Mail className="w-4 h-4" />
          {isSaving ? "Creating..." : "Create Campaign"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
      </div>
    </div>
  );
}
