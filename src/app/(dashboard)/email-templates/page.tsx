import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus, FileText, Eye, Pencil, Copy, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Email Templates" };

export default async function EmailTemplatesPage() {
  const session = await requireSession();

  const templates = await prisma.emailTemplate.findMany({
    where: { organizationId: session.organizationId, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
          <p className="text-gray-500 text-sm">{templates.length} templates</p>
        </div>
        <Link href="/email-templates/new" className="btn-primary">
          <Plus className="w-4 h-4" /> New Template
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="card">
          <div className="empty-state py-16">
            <FileText className="w-12 h-12 mb-4 opacity-30" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No templates yet</h3>
            <p className="text-gray-400 text-sm mb-6">Create reusable email templates with personalization variables</p>
            <Link href="/email-templates/new" className="btn-primary"><Plus className="w-4 h-4" /> Create Template</Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="flex gap-1">
                  <Link href={`/email-templates/${t.id}/edit`} className="btn-ghost p-1.5">
                    <Pencil className="w-3.5 h-3.5" />
                  </Link>
                  <button className="btn-ghost p-1.5"><Copy className="w-3.5 h-3.5" /></button>
                  <button className="btn-ghost p-1.5 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{t.name}</h3>
              <p className="text-xs text-gray-500 mb-3 line-clamp-1">{t.subject}</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {t.variables.slice(0, 4).map((v) => (
                  <span key={v} className="badge badge-gray text-xs">{`{{${v}}}`}</span>
                ))}
                {t.variables.length > 4 && <span className="badge badge-gray text-xs">+{t.variables.length - 4}</span>}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">{formatDate(t.createdAt)}</span>
                <Link href={`/email-templates/${t.id}`} className="btn-ghost text-xs py-1 px-2 text-amber-600">
                  <Eye className="w-3.5 h-3.5" /> Preview
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
