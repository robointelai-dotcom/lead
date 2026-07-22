"use client";

import { useActionState, useState, useEffect } from "react";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { uploadCsvAction, type ImportActionState } from "./actions";
import { getSearchJobStatusAction, type SearchJobStatusDTO } from "../../search/actions";
import Link from "next/link";

interface Campaign {
  id: string;
  name: string;
}

const initialState: ImportActionState = { success: false };

export default function ImportCsvClient({
  campaigns,
}: {
  campaigns: Campaign[];
}) {
  const [state, action, isPending] = useActionState(uploadCsvAction, initialState);
  const [status, setStatus] = useState<SearchJobStatusDTO | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Poll for progress once a job is enqueued
  useEffect(() => {
    if (state.success && state.jobId) {
      setIsPolling(true);
      const interval = setInterval(async () => {
        const currentStatus = await getSearchJobStatusAction(state.jobId!);
        if (currentStatus) {
          setStatus(currentStatus);
          if (currentStatus.status === "COMPLETED" || currentStatus.status === "FAILED") {
            setIsPolling(false);
            clearInterval(interval);
          }
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [state.success, state.jobId]);

  return (
    <div className="card p-8">
      {!state.success ? (
        <form action={action} className="space-y-6">
          <div className="space-y-2">
            <label className="form-label">Target Campaign</label>
            <select name="campaignId" className="form-input" required>
              <option value="">-- Select a Campaign --</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <input
              type="checkbox"
              name="autoDispatchToGithub"
              value="true"
              id="autoDispatch"
              className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
            />
            <label htmlFor="autoDispatch" className="text-sm font-medium text-gray-700">
              Auto-dispatch to GitHub Automation after import
            </label>
          </div>

          <div className="space-y-2">
            <label className="form-label">CSV File</label>
            <div className="relative border-2 border-dashed border-gray-200 rounded-xl p-10 flex flex-col items-center justify-center hover:border-amber-300 transition-colors bg-gray-50">
              <input
                name="file"
                type="file"
                accept=".csv"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                required
              />
              <Upload className="w-10 h-10 text-gray-400 mb-4" />
              <p className="text-sm font-medium text-gray-900">Click to upload or drag and drop</p>
              <p className="text-xs text-gray-500 mt-1">Only .csv files are supported</p>
            </div>
          </div>

          {state.error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{state.error}</p>
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={isPending}
              className="btn-primary w-full py-3 text-lg"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Parsing CSV...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5 mr-2" />
                  Start Automated Import
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        <div className="text-center py-4 space-y-6">
          {status?.status === "COMPLETED" ? (
            <div className="space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Import Complete!</h2>
                <p className="text-gray-500">
                  Successfully processed {status.totalProcessed} records.
                  Added {status.totalFound} new leads.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-4">
                <Link href="/leads" className="btn-primary">View All Leads</Link>
                <button 
                  onClick={() => window.location.reload()} 
                  className="btn-secondary"
                >
                  Import Another
                </button>
              </div>
            </div>
          ) : status?.status === "FAILED" ? (
            <div className="space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-10 h-10 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Import Failed</h2>
                <p className="text-red-600 text-sm">{status.errorMessage}</p>
              </div>
              <button onClick={() => window.location.reload()} className="btn-primary">Try Again</button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
                <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Processing Your Leads...</h2>
                <p className="text-gray-500 mt-1">
                  Our Power AI is discovering missing emails and cleaning data.
                </p>
              </div>
              
              <div className="max-w-xs mx-auto">
                <div className="flex justify-between text-xs font-medium text-gray-500 mb-2">
                  <span>Progress</span>
                  <span>{status?.totalProcessed || 0} leads processed</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{ 
                      width: status?.totalProcessed 
                        ? `${Math.min(100, (status.totalProcessed / (status.totalProcessed + 10)) * 100)}%` 
                        : "5%" 
                    }}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto pt-4">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-lg font-bold text-gray-900">{status?.totalFound || 0}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Saved Leads</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-lg font-bold text-gray-900">{status?.totalWithEmail || 0}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Emails Found</p>
                </div>
              </div>
              
              <p className="text-xs text-gray-400">
                You can safely leave this page. The import will continue in the background.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
