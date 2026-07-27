import PDFDocument from "pdfkit";

export async function createPdfBuffer(report: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];
      doc.on("data", (b) => buffers.push(b));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      doc.fontSize(24).font("Helvetica-Bold").text(report.name, { align: "center" });
      doc.moveDown(1.5);

      const data = report.data || {};

      if (report.type === "CAMPAIGN") {
        const stats = data.stats || {};
        doc.fontSize(16).text("Campaign Statistics", { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).font("Helvetica");
        for (const [key, value] of Object.entries(stats)) {
          doc.text(`${key}: ${value}`);
        }
      } else if (report.type === "CUSTOM") {
        const lead = data.lead || {};
        const memberships = data.memberships || [];
        
        doc.fontSize(16).font("Helvetica-Bold").text("Lead Profile", { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).font("Helvetica");
        
        doc.text(`Business Name: ${lead.businessName || "N/A"}`);
        doc.text(`Email: ${lead.email || "N/A"}`);
        doc.text(`Phone: ${lead.phone || "N/A"}`);
        doc.text(`Website: ${lead.website || "N/A"}`);
        doc.text(`Quality Score: ${lead.qualityScore || "0"}/100`);
        doc.text(`Category: ${lead.category || "N/A"}`);
        doc.text(`Address: ${lead.address || ""}, ${lead.city || ""}, ${lead.state || ""}`);
        
        doc.moveDown(1.5);
        doc.fontSize(16).font("Helvetica-Bold").text("Campaign Memberships", { underline: true });
        doc.moveDown(0.5);
        
        doc.fontSize(12).font("Helvetica");
        if (memberships.length === 0) {
          doc.text("No active campaigns.");
        } else {
          memberships.forEach((m: any) => {
            doc.text(`- ${m.campaignName || "Unknown"}: ${m.status}`);
          });
        }
      } else {
        doc.fontSize(12).font("Helvetica").text(JSON.stringify(data, null, 2));
      }

      doc.moveDown(2);
      doc.fontSize(10).fillColor("gray").text(`Generated on: ${new Date().toLocaleString()}`, { align: "center" });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
