import { requireSession } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const session = await requireSession();

    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar session={session} />
        <div
          className="flex-1 flex flex-col min-w-0 overflow-hidden"
          style={{ marginLeft: "var(--sidebar-width)" }}
        >
          <Header session={session} />
          <main className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="p-6 max-w-[1400px] mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    );
  } catch (err: any) {
    // If it's a redirect error (from requireSession), re-throw it so Next.js can handle it
    if (err.digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }

    console.error("[layout] crash:", err);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-red-100">
          <h1 className="text-xl font-bold text-red-600 mb-2">System Error</h1>
          <p className="text-gray-600 text-sm mb-4">The dashboard layout failed to initialize. This usually indicates a problem with the database connection or authentication service.</p>
          <pre className="text-[10px] bg-red-50 p-4 rounded border border-red-100 overflow-auto max-h-40 mb-4">
            {err.message || String(err)}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
}
