"use client";

import { Zap, Clock, Mail, Search, Download } from "lucide-react";
import { useState } from "react";

export default function EmailLogsClient({
  emailLogs = [],
}: {
  emailLogs: any[];
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredLogs = emailLogs.filter((log) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.recipientEmail?.toLowerCase().includes(term) ||
      log.subject?.toLowerCase().includes(term) ||
      log.lead?.businessName?.toLowerCase().includes(term) ||
      log.status?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-500 fill-blue-500" />
            Send Logs & History
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Track all automated and manual outreach emails sent via GMass or other providers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search emails..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-9 w-[250px] text-sm h-10"
            />
          </div>
          <button onClick={() => window.location.reload()} className="btn-secondary h-10 px-4">
            <Clock className="w-4 h-4 mr-2" /> Refresh
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3 border border-gray-100">
              <Mail className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-900 font-medium">No outreach emails found.</p>
            <p className="text-gray-500 text-sm mt-1">When automations run, their email logs will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Recipient</th>
                  <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject & Preview</th>
                  <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Provider</th>
                  <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4 align-top">
                      <div className="font-medium text-sm text-gray-900">
                        {log.lead?.businessName || "Unknown Business"}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{log.recipientEmail}</div>
                    </td>
                    <td className="px-5 py-4 align-top max-w-[300px]">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {log.subject}
                      </div>
                      {log.lastErrorMessage && (
                        <div className="text-[11px] text-red-600 mt-1.5 bg-red-50 p-2 rounded border border-red-100 font-mono inline-block">
                          Error: {log.lastErrorMessage}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="inline-flex items-center px-2 py-1 rounded bg-gray-100 border border-gray-200 text-xs font-medium text-gray-600 capitalize">
                        {log.provider}
                      </div>
                      {log.providerMessageId && (
                        <div className="text-[10px] text-gray-400 font-mono mt-1.5 truncate max-w-[100px]" title={log.providerMessageId}>
                          ID: {log.providerMessageId}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 align-top">
                      {log.status?.toLowerCase() === "sent" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-xs font-medium text-green-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                          Sent
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-top text-right whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(log.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
