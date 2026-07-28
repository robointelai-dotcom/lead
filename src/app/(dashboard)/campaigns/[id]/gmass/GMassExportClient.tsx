"use client";

import { useState } from "react";
import { Loader2, Download, Wand2 } from "lucide-react";

interface Lead {
  id: string;
  businessName: string;
  email: string;
  phone?: string;
  city?: string;
  category?: string;
  rating?: number;
  website?: string;
}

export default function GMassExportClient({ campaign, leads, hostUrl }: { campaign: any; leads: Lead[]; hostUrl: string }) {
  const [prompt, setPrompt] = useState(
    "Write a short, engaging 2-sentence cold email to pitch our AI Growth tools. Keep it extremely brief and professional. Do NOT include the subject line, greeting, or sign-off, just the body text."
  );
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{lead: Lead, emailBody: string, reportLink: string}[]>([]);

  const handleGenerate = async () => {
    if (leads.length === 0) {
      alert("No leads with valid emails found in this campaign.");
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setResults([]);

    const generatedResults: {lead: Lead, emailBody: string, reportLink: string}[] = [];

    // Process sequentially to not overload API limits, but could be batched.
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      try {
        const res = await fetch("/api/gmass/generate-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, lead }),
        });
        
        let emailBody = "";
        if (res.ok) {
          const data = await res.json();
          emailBody = data.email || "";
        } else {
          console.error("Failed to generate for", lead.businessName);
          emailBody = "Failed to generate AI email.";
        }

        // Construct the Report Link
        const reportLink = `${hostUrl}/api/reports/${lead.id}/export?format=pdf`;

        generatedResults.push({ lead, emailBody, reportLink });
      } catch (err) {
        console.error("Error for", lead.businessName, err);
        generatedResults.push({ lead, emailBody: "Error generating.", reportLink: `${hostUrl}/api/reports/${lead.id}/export?format=pdf` });
      }

      setProgress(Math.round(((i + 1) / leads.length) * 100));
    }

    setResults(generatedResults);
    setIsGenerating(false);
  };

  const handleDownload = () => {
    if (results.length === 0) return;

    // Build CSV Content
    const headers = ["FirstName", "BusinessName", "Email", "Phone", "Website", "PersonalizedMessage", "ReportLink"];
    const escapeCsv = (str: string) => `"${String(str || "").replace(/"/g, '""')}"`;

    let csvContent = headers.join(",") + "\n";

    results.forEach(({ lead, emailBody, reportLink }) => {
      const row = [
        escapeCsv(lead.businessName.split(" ")[0] || ""), // First Name heuristic
        escapeCsv(lead.businessName),
        escapeCsv(lead.email),
        escapeCsv(lead.phone || ""),
        escapeCsv(lead.website || ""),
        escapeCsv(emailBody),
        escapeCsv(reportLink)
      ];
      csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gmass-campaign-${campaign.name.replace(/\\s+/g, "-")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">AI Email Prompt Template</label>
          <p className="text-xs text-gray-500 mb-3">
            Instruct the AI on how to write the `PersonalizedMessage` column for each lead. The AI has access to the lead's business name, location, and rating.
          </p>
          <textarea
            className="form-input w-full h-32 text-sm"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isGenerating}
          />
          
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-1">GMass Variables Available in Output CSV:</h4>
            <ul className="text-xs text-blue-800 list-disc list-inside space-y-1">
              <li>{'{FirstName}'} - Inferred from business name</li>
              <li>{'{BusinessName}'} - Full business name</li>
              <li>{'{PersonalizedMessage}'} - AI Generated Email Body</li>
              <li>{'{ReportLink}'} - Unique PDF Audit Link</li>
            </ul>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Target Leads: <span className="text-indigo-600">{leads.length} leads with email</span></h3>
          <div className="bg-gray-50 rounded-lg border border-gray-100 p-4 h-[250px] overflow-y-auto">
            {leads.map(lead => (
              <div key={lead.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                <div className="truncate pr-4">
                  <p className="text-sm font-medium text-gray-900 truncate">{lead.businessName}</p>
                  <p className="text-xs text-gray-500 truncate">{lead.email}</p>
                </div>
              </div>
            ))}
            {leads.length === 0 && <p className="text-sm text-gray-500 text-center py-8">No valid leads found.</p>}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 flex flex-col md:flex-row items-center gap-4 justify-between">
        <div className="w-full md:w-1/2">
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium text-gray-700">
                <span>Generating AI Emails...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}
          {results.length > 0 && !isGenerating && (
            <p className="text-sm text-green-600 font-medium">✅ Successfully generated {results.length} personalized emails.</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || leads.length === 0}
            className="btn-secondary"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
            Generate AI Emails
          </button>

          <button
            onClick={handleDownload}
            disabled={results.length === 0 || isGenerating}
            className="btn-primary"
          >
            <Download className="w-4 h-4 mr-2" />
            Download GMass CSV
          </button>
        </div>
      </div>
    </div>
  );
}
