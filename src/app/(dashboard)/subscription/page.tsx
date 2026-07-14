import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreditCard, Check, Zap } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/utils";

export const metadata = { title: "Subscription & Usage" };

const plans = [
  {
    id: "FREE",
    name: "Free",
    price: "$0",
    period: "/month",
    searches: 100,
    emails: 500,
    campaigns: 3,
    members: 2,
    features: ["100 searches/mo", "500 emails/mo", "3 campaigns", "2 team members", "Basic reports"],
  },
  {
    id: "STARTER",
    name: "Starter",
    price: "$49",
    period: "/month",
    searches: 500,
    emails: 2500,
    campaigns: 10,
    members: 5,
    features: ["500 searches/mo", "2,500 emails/mo", "10 campaigns", "5 team members", "Advanced reports", "CSV export"],
    popular: false,
  },
  {
    id: "PROFESSIONAL",
    name: "Professional",
    price: "$99",
    period: "/month",
    searches: 2000,
    emails: 10000,
    campaigns: 50,
    members: 15,
    features: ["2,000 searches/mo", "10,000 emails/mo", "50 campaigns", "15 team members", "Full reports", "PDF export", "API access"],
    popular: true,
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: "Custom",
    period: "",
    searches: 999999,
    emails: 999999,
    campaigns: 999999,
    members: 999999,
    features: ["Unlimited searches", "Unlimited emails", "Unlimited campaigns", "Unlimited members", "Custom integrations", "Priority support", "White-label"],
  },
];

export default async function SubscriptionPage() {
  const session = await requireSession();

  const [subscription, usage] = await Promise.all([
    prisma.subscription.findUnique({ where: { organizationId: session.organizationId } }),
    prisma.usageRecord.findUnique({
      where: {
        organizationId_period: {
          organizationId: session.organizationId,
          period: new Date().toISOString().slice(0, 7),
        },
      },
    }),
  ]);

  const currentPlan = plans.find((p) => p.id === (subscription?.plan || "FREE")) || plans[0];
  const searchesUsed = usage?.searchesUsed || 0;
  const emailsUsed = usage?.emailsUsed || 0;
  const searchLimit = subscription?.monthlySearchLimit || 100;
  const emailLimit = subscription?.monthlyEmailLimit || 500;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscription & Usage</h1>
        <p className="text-gray-500 text-sm">Manage your plan and monitor your usage</p>
      </div>

      {/* Current plan */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Current Plan</p>
            <h2 className="text-3xl font-bold text-gray-900 mt-1">{currentPlan.name}</h2>
            <p className="text-gray-400 text-sm mt-1">
              Renews {formatDate(subscription?.currentPeriodEnd)} · Status: {subscription?.status || "Active"}
            </p>
          </div>
          <div className="text-right">
            <span className="badge badge-amber text-sm">{subscription?.plan || "FREE"}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {[
            { label: "Searches Used", used: searchesUsed, limit: searchLimit },
            { label: "Emails Used", used: emailsUsed, limit: emailLimit },
            { label: "Campaigns", used: 0, limit: subscription?.maxCampaigns || 3, showUsage: false },
            { label: "Team Members", used: 0, limit: subscription?.maxTeamMembers || 2, showUsage: false },
          ].map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">{item.label}</span>
                <span className="text-xs font-medium text-gray-700">
                  {item.limit === 999999 ? "∞" : `${formatNumber(item.used)}/${formatNumber(item.limit)}`}
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: item.limit === 999999 ? "10%" : `${Math.min((item.used / item.limit) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Plans */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.id === (subscription?.plan || "FREE");
            return (
              <div
                key={plan.id}
                className={`card p-5 relative ${plan.popular ? "border-amber-300 ring-1 ring-amber-300" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Most Popular
                    </span>
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="font-bold text-gray-900">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-bold">{plan.price}</span>
                    <span className="text-gray-400 text-sm">{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-2 mb-5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  disabled={isCurrent}
                  className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                    isCurrent
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : plan.popular
                      ? "bg-amber-500 text-white hover:bg-amber-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {isCurrent ? "Current Plan" : plan.id === "ENTERPRISE" ? "Contact Sales" : "Upgrade"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
