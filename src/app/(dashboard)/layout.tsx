import { requireSession } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
}
