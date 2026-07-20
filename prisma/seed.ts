import "dotenv/config";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

config({ path: ".env.local", override: false });

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding LeadFlow Pro database...");

  // Create org
  const org = await prisma.organization.upsert({
    where: { slug: "acme-agency" },
    update: {},
    create: {
      name: "Acme Lead Agency",
      slug: "acme-agency",
      industry: "Marketing Agency",
      timezone: "America/New_York",
    },
  });
  console.log("✅ Organization created:", org.name);

  // Create users
  const passwordHash = await bcrypt.hash("password123", 12);

  const owner = await prisma.user.upsert({
    where: { email: "admin@acme.com" },
    update: {},
    create: {
      email: "admin@acme.com",
      name: "Alex Johnson",
      passwordHash,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "sarah@acme.com" },
    update: {},
    create: {
      email: "sarah@acme.com",
      name: "Sarah Chen",
      passwordHash,
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: "mike@acme.com" },
    update: {},
    create: {
      email: "mike@acme.com",
      name: "Mike Torres",
      passwordHash,
    },
  });

  // Memberships
  const ownerMember = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: owner.id } },
    update: {},
    create: {
      organizationId: org.id,
      userId: owner.id,
      role: "OWNER",
      joinedAt: new Date(),
    },
  });

  const managerMember = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: manager.id } },
    update: {},
    create: {
      organizationId: org.id,
      userId: manager.id,
      role: "MANAGER",
      joinedAt: new Date(),
    },
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: agent.id } },
    update: {},
    create: {
      organizationId: org.id,
      userId: agent.id,
      role: "AGENT",
      joinedAt: new Date(),
    },
  });

  console.log("✅ Users and memberships created");

  // Subscription
  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      plan: "PROFESSIONAL",
      status: "ACTIVE",
      monthlySearchLimit: 1000,
      monthlyEmailLimit: 5000,
      maxCampaigns: 20,
      maxTeamMembers: 10,
      currentPeriodStart: new Date(),
      currentPeriodEnd: addDays(new Date(), 30),
    },
  });

  // Tags
  const tagColors = ["#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#ec4899"];
  const tagNames = ["Hot Lead", "Cold Lead", "VIP", "Follow Up", "Email Sent", "Priority"];
  const tags: Array<{ id: string; name: string }> = [];

  for (let i = 0; i < tagNames.length; i++) {
    const tag = await prisma.tag.upsert({
      where: { organizationId_name: { organizationId: org.id, name: tagNames[i] } },
      update: {},
      create: {
        organizationId: org.id,
        name: tagNames[i],
        color: tagColors[i],
      },
    });
    tags.push(tag);
  }

  // Campaigns
  const campaigns = [
    {
      name: "NYC Restaurants Q3",
      niche: "Restaurant",
      country: "US",
      state: "NY",
      city: "New York",
      status: "ACTIVE" as const,
      goal: "Find 500 restaurant leads for email outreach",
    },
    {
      name: "LA Dentists Campaign",
      niche: "Dentist",
      country: "US",
      state: "CA",
      city: "Los Angeles",
      status: "ACTIVE" as const,
      goal: "Generate dental practice leads for SEO upsell",
    },
    {
      name: "Chicago Plumbers Drive",
      niche: "Plumber",
      country: "US",
      state: "IL",
      city: "Chicago",
      status: "PAUSED" as const,
      goal: "Build pipeline of plumbing contractors",
    },
    {
      name: "Texas Lawyers Outreach",
      niche: "Lawyer",
      country: "US",
      state: "TX",
      city: "Houston",
      status: "DRAFT" as const,
      goal: "Target law firms for marketing services",
    },
  ];

  const createdCampaigns = [];
  for (const c of campaigns) {
    const campaign = await prisma.campaign.create({
      data: {
        organizationId: org.id,
        name: c.name,
        niche: c.niche,
        country: c.country,
        state: c.state,
        city: c.city,
        status: c.status,
        goal: c.goal,
        assignedUserId: ownerMember.id,
        startDate: subDays(new Date(), 30),
        endDate: addDays(new Date(), 60),
      },
    });
    createdCampaigns.push(campaign);
  }

  console.log("✅ Campaigns created:", createdCampaigns.length);

  // Leads
  const leadData = [
    { businessName: "Joe's Italian Kitchen", category: "Restaurant", city: "New York", state: "NY", email: "joe@italianktichen.com", phone: "+1 (212) 555-0101", website: "https://joesitaliankitchen.com", rating: 4.5, reviewCount: 234, isVerified: true, isClaimed: true },
    { businessName: "Manhattan Steakhouse", category: "Restaurant", city: "New York", state: "NY", email: "info@manhattansteak.com", phone: "+1 (212) 555-0102", website: "https://manhattansteak.com", rating: 4.2, reviewCount: 189, isVerified: true, isClaimed: true },
    { businessName: "Brooklyn Burger Co", category: "Restaurant", city: "New York", state: "NY", email: "hello@brooklynburger.com", phone: "+1 (718) 555-0103", website: null, rating: 3.9, reviewCount: 67, isVerified: false, isClaimed: false },
    { businessName: "NYC Sushi Express", category: "Restaurant", city: "New York", state: "NY", email: null, phone: "+1 (646) 555-0104", website: "https://nycsushi.com", rating: 4.7, reviewCount: 412, isVerified: true, isClaimed: true },
    { businessName: "Uptown Thai House", category: "Restaurant", city: "New York", state: "NY", email: "uptownthaihouse@gmail.com", phone: "+1 (917) 555-0105", website: null, rating: 4.1, reviewCount: 98, isVerified: false, isClaimed: false },
    { businessName: "Smile Bright Dental", category: "Dentist", city: "Los Angeles", state: "CA", email: "smilebrightla@gmail.com", phone: "+1 (310) 555-0201", website: "https://smilebrightdental.com", rating: 4.8, reviewCount: 302, isVerified: true, isClaimed: true },
    { businessName: "LA Family Dentistry", category: "Dentist", city: "Los Angeles", state: "CA", email: "info@lafamilydentistry.com", phone: "+1 (323) 555-0202", website: "https://lafamilydentistry.com", rating: 4.3, reviewCount: 156, isVerified: true, isClaimed: true },
    { businessName: "Dr. Kim's Orthodontics", category: "Dentist", city: "Los Angeles", state: "CA", email: null, phone: "+1 (213) 555-0203", website: "https://drkimsortho.com", rating: 4.6, reviewCount: 89, isVerified: true, isClaimed: false },
    { businessName: "Windy City Plumbing", category: "Plumber", city: "Chicago", state: "IL", email: "info@windycityplumbing.com", phone: "+1 (312) 555-0301", website: "https://windycityplumbing.com", rating: 4.4, reviewCount: 211, isVerified: true, isClaimed: true },
    { businessName: "Pro Pipe Solutions", category: "Plumber", city: "Chicago", state: "IL", email: "contact@propipesolutions.com", phone: "+1 (773) 555-0302", website: null, rating: 3.8, reviewCount: 44, isVerified: false, isClaimed: false },
  ];

  const leadStatuses: Array<"NEW" | "CONTACTED" | "REPLIED" | "QUALIFIED" | "PROPOSAL_SENT" | "WON" | "LOST"> = ["NEW", "CONTACTED", "REPLIED", "QUALIFIED", "PROPOSAL_SENT", "WON", "LOST"];
  const createdLeads = [];

  for (let i = 0; i < leadData.length; i++) {
    const ld = leadData[i];
    const normalizedEmail = ld.email ? ld.email.toLowerCase().trim() : null;
    const normalizedPhone = ld.phone ? ld.phone.replace(/\D/g, "") : null;
    const normalizedDomain = ld.website ? ld.website.replace(/https?:\/\/(www\.)?/, "").split("/")[0].toLowerCase() : null;
    const normalizedName = ld.businessName.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();

    const qualityScore = (ld.email ? 25 : 0) + (ld.phone ? 20 : 0) + (ld.website ? 15 : 0) + ((ld.rating || 0) >= 4 ? 15 : 0) + ((ld.reviewCount || 0) >= 10 ? 10 : 0) + (ld.isVerified ? 10 : 0) + (ld.isClaimed ? 5 : 0);

    const lead = await prisma.lead.create({
      data: {
        organizationId: org.id,
        businessName: ld.businessName,
        category: ld.category,
        city: ld.city,
        state: ld.state,
        country: "US",
        email: ld.email,
        phone: ld.phone,
        website: ld.website,
        rating: ld.rating,
        reviewCount: ld.reviewCount,
        isVerified: ld.isVerified,
        isClaimed: ld.isClaimed,
        qualityScore,
        normalizedEmail,
        normalizedPhone,
        normalizedDomain,
        normalizedName,
        sourceProvider: "mock",
        sourceId: `seed-${i}`,
      },
    });

    // Assign to campaign
    const campaignIdx = i < 5 ? 0 : i < 8 ? 1 : 2;
    const campaignLead = await prisma.campaignLead.create({
      data: {
        campaignId: createdCampaigns[campaignIdx].id,
        leadId: lead.id,
        status: leadStatuses[i % leadStatuses.length],
        assignedUserId: i % 2 === 0 ? owner.id : manager.id,
      },
    });

    // Add some notes
    if (i < 5) {
      await prisma.leadNote.create({
        data: {
          campaignLeadId: campaignLead.id,
          userId: owner.id,
          content: `Initial outreach done. Lead shows interest in ${["website redesign", "SEO services", "email marketing", "PPC campaigns", "social media"][i % 5]}.`,
        },
      });
    }

    createdLeads.push(lead);
  }

  console.log("✅ Leads created:", createdLeads.length);

  // Email Templates
  const templates = [
    {
      name: "Initial Outreach",
      subject: "Quick question about {{business_name}}",
      htmlContent: `<p>Hi {{contact_name}},</p><p>I came across {{business_name}} in {{city}} and was impressed by your {{category}} services.</p><p>I help businesses like yours grow their online presence and attract more customers. Would you be open to a quick 15-minute call?</p><p>Best,<br>{{sender_name}}<br>{{company_name}}</p>`,
    },
    {
      name: "Follow Up",
      subject: "Following up on my previous email - {{business_name}}",
      htmlContent: `<p>Hi {{contact_name}},</p><p>I wanted to follow up on my previous email. I know you're busy running {{business_name}}, so I'll keep this brief.</p><p>I help {{category}} businesses in {{city}} increase their leads by 40-60% through targeted digital marketing.</p><p>Would a quick call this week work?</p><p>Best,<br>{{sender_name}}</p>`,
    },
    {
      name: "Value Proposition",
      subject: "How we helped 3 {{category}} businesses in {{city}} double their leads",
      htmlContent: `<p>Hi {{contact_name}},</p><p>I work with {{category}} businesses like {{business_name}} in {{city}} to dramatically increase their online visibility and customer acquisition.</p><p>Here's what we typically achieve:</p><ul><li>50-100% more website traffic in 90 days</li><li>3-5x more qualified leads per month</li><li>Improved Google Maps rankings</li></ul><p>Happy to share a free audit of your current online presence. Interested?</p><p>Best,<br>{{sender_name}}<br>{{company_name}}</p>`,
    },
  ];

  for (const t of templates) {
    await prisma.emailTemplate.create({
      data: {
        organizationId: org.id,
        name: t.name,
        subject: t.subject,
        htmlContent: t.htmlContent,
        variables: ["business_name", "contact_name", "city", "state", "category", "sender_name", "company_name"],
      },
    });
  }

  console.log("✅ Email templates created:", templates.length);

  // Usage Record
  const period = new Date().toISOString().slice(0, 7);
  await prisma.usageRecord.upsert({
    where: { organizationId_period: { organizationId: org.id, period } },
    update: {},
    create: {
      organizationId: org.id,
      period,
      searchesUsed: 42,
      emailsUsed: 187,
      leadsStored: createdLeads.length,
    },
  });

  console.log("✅ Usage records created");
  console.log("\n🎉 Seeding complete!");
  console.log("\n📧 Login credentials:");
  console.log("   Email: admin@acme.com");
  console.log("   Password: password123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

// Helper for date arithmetic (inline to avoid import issues)
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function subDays(date: Date, days: number): Date {
  return addDays(date, -days);
}
