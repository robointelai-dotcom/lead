"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-red-100 text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">A critical error occurred</h1>
            <p className="text-gray-600 text-sm mb-6">The application encountered an unexpected failure. Technical details below:</p>
            <div className="bg-red-50 p-4 rounded-lg text-left mb-6">
              <p className="text-red-700 font-mono text-[10px] break-all">{error.message || "Unknown Error"}</p>
              {error.digest && <p className="text-red-500 font-mono text-[10px] mt-2">Digest: {error.digest}</p>}
            </div>
            <button
              onClick={() => reset()}
              className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
              Try to recover
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
