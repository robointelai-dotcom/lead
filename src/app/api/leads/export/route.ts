import { NextRequest, NextResponse } from "next/server";
import { stringify } from "csv-stringify/sync";
import { supabase } from "@/lib/supabase";
import { requireSession } from "@/lib/auth";

/**
 * GET /api/leads/export
 * Exports all saved leads for the organization as a CSV file.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();

    // Fetch all leads for the organization
    const { data: leads, error } = await supabase
      .from("leads")
      .select("*")
      .eq("organizationId", session.organizationId)
      .order("createdAt", { ascending: false });

    if (error) throw error;

    if (!leads || leads.length === 0) {
      return NextResponse.json({ error: "No leads found to export" }, { status: 404 });
    }

    // Format leads for CSV
    const csvData = leads.map((l) => ({
      "Business Name": l.businessName,
      Category: l.category,
      Email: l.email,
      Phone: l.phone,
      Website: l.website,
      Address: l.address,
      City: l.city,
      State: l.state,
      Country: l.country,
      "Postal Code": l.postalCode,
      Rating: l.rating,
      "Review Count": l.reviewCount,
      "Quality Score": l.qualityScore,
      "Source Provider": l.sourceProvider,
      "Added At": new Date(l.createdAt).toLocaleString(),
    }));

    const csvString = stringify(csvData, {
      header: true,
      columns: [
        "Business Name",
        "Category",
        "Email",
        "Phone",
        "Website",
        "Address",
        "City",
        "State",
        "Country",
        "Postal Code",
        "Rating",
        "Review Count",
        "Quality Score",
        "Source Provider",
        "Added At",
      ],
    });

    return new NextResponse(csvString, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="leads-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err: any) {
    console.error("[leads-export] export failed:", err);
    return NextResponse.json(
      { error: err.message || "Failed to export leads" },
      { status: 500 }
    );
  }
}
