import PDFDocument from "pdfkit";
import { type WebsiteAuditReport } from "./report-generator";

export interface PdfGenerationResult {
  buffer: Buffer;
  filename: string;
  contentType: "application/pdf";
  generatedAt: Date;
}

export async function generateReportPdf(report: {
  name: string;
  type: string;
  data: WebsiteAuditReport;
}): Promise<PdfGenerationResult> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const buffers: Buffer[] = [];
      doc.on("data", (b) => buffers.push(b));
      doc.on("end", () =>
        resolve({
          buffer: Buffer.concat(buffers),
          filename: `business-name-growth-readiness-report.pdf`,
          contentType: "application/pdf",
          generatedAt: new Date(),
        })
      );

      const data = report.data;

      // Extract real data from the report (NO fake data allowed)
      const businessName = data.business?.name || "Unknown Business";
      const address = data.business?.location || "Address not verified";
      const website = data.business?.website || "Website not verified";
      const phone = data.business?.phone || "Phone not verified";

      const colors = {
        bg: "#F4F4F0",
        headerBg: "#0B4F46",
        textDark: "#1F2937",
        textMuted: "#6B7280",
        white: "#FFFFFF",
        green: "#2E7D32",
        yellow: "#EF6C00",
        red: "#C62828",
        border: "#E5E7EB",
      };

      const margin = 54;
      const pageW = doc.page.width;

      doc.on("pageAdded", () => {
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(colors.bg);
      });

      // 1st Page Background
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(colors.bg);

      // --- PAGE 1: HEADER ---
      doc.rect(0, 0, doc.page.width, 180).fill(colors.headerBg);

      doc.fillColor(colors.white)
        .font("Helvetica-Bold")
        .fontSize(22)
        .text(businessName, margin, 35, { width: 320 });
      doc.font("Helvetica")
        .fontSize(10)
        .text(`${address}\n${phone} | ${website}`, margin, 65, {
          width: 320,
          lineGap: 4,
        });

      doc.font("Helvetica-Bold")
        .fontSize(14)
        .text("REPORT", doc.page.width - margin - 150, 35, {
          width: 150,
          align: "right",
        });
      doc.fillColor("#A3E4D7")
        .font("Helvetica")
        .fontSize(9)
        .text(
          `ID: ${data.id || "N/A"}\nDate: ${new Date(
            data.generatedAt || Date.now()
          ).toLocaleDateString()}`,
          doc.page.width - margin - 150,
          52,
          { width: 150, align: "right", lineGap: 3 }
        );

      doc.y = 200;

      const drawSectionHeader = (
        num: string,
        title: string,
        subtitle: string,
        y: number
      ) => {
        doc.lineWidth(2).strokeColor(colors.yellow).circle(margin + 12, y + 10, 12).stroke();
        doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(12).text(num, margin + 8, y + 4);
        doc.fillColor(colors.textDark).font("Times-Bold").fontSize(18).text(title, margin + 35, y);
        doc.fillColor(colors.textMuted).font("Helvetica").fontSize(10).text(subtitle, margin + 35, y + 20);
        return y + 50;
      };

      const drawCard = (
        x: number,
        y: number,
        w: number,
        h: number,
        statusColor: string,
        label: string,
        value: string,
        desc: string
      ) => {
        doc.roundedRect(x, y, w, h, 6).fillAndStroke(colors.white, colors.border);
        doc.rect(x, y + 6, 5, h - 12).fill(statusColor);

        doc.fillColor(colors.textMuted)
          .font("Helvetica-Bold")
          .fontSize(9)
          .text(label.toUpperCase(), x + 18, y + 15, { width: w - 24 });
        doc.fillColor(colors.textDark)
          .font("Helvetica-Bold")
          .fontSize(16) // reduced font size to fit actual data
          .text(value, x + 18, y + 28, { width: w - 24 });
        doc.fillColor(colors.textMuted)
          .font("Helvetica")
          .fontSize(9)
          .text(desc, x + 18, y + 58, { width: w - 24, lineGap: 2 });
      };

      let currY = 200;
      const colW2 = (pageW - margin * 2 - 15) / 2;

      currY = drawSectionHeader("1", "Website Health & Technical Audit", "Automated technical checks on the provided website.", currY);

      const isReachable = data.websiteChecks?.reachable ? "Yes" : "No";
      const loadTime = data.performance?.mobileLoadTimeSeconds ? `${data.performance.mobileLoadTimeSeconds}s` : "Not Available";

      drawCard(margin, currY, colW2, 90, data.websiteChecks?.reachable ? colors.green : colors.red, "Reachable", isReachable, "Can the website be accessed?");
      drawCard(margin + colW2 + 15, currY, colW2, 90, data.performance?.mobileLoadTimeSeconds && parseFloat(data.performance.mobileLoadTimeSeconds) < 3.5 ? colors.green : colors.yellow, "Response Time", loadTime, "Server initial response time.");

      currY += 105;

      currY = drawSectionHeader("2", "Tracking & Analytics", "Installed marketing and analytics tags.", currY);

      const hasAnalytics = data.websiteChecks?.analyticsDetected?.length ? data.websiteChecks.analyticsDetected.join(", ") : "None Detected";
      const hasPixels = data.websiteChecks?.marketingPixelsDetected?.length ? data.websiteChecks.marketingPixelsDetected.join(", ") : "None Detected";

      drawCard(margin, currY, colW2, 90, data.websiteChecks?.analyticsDetected?.length ? colors.green : colors.yellow, "Analytics", hasAnalytics, "Website analytics tracking.");
      drawCard(margin + colW2 + 15, currY, colW2, 90, data.websiteChecks?.marketingPixelsDetected?.length ? colors.green : colors.yellow, "Marketing Pixels", hasPixels, "Retargeting/ad pixels.");

      currY += 105;

      doc.addPage();
      currY = margin;

      currY = drawSectionHeader("3", "Detailed Findings", "Specific technical observations", currY);

      if (data.findings && data.findings.length > 0) {
        data.findings.forEach((finding) => {
          doc.fillColor(colors.textDark).font("Helvetica-Bold").fontSize(12).text(finding.title, margin, currY);
          currY += 20;
          doc.fillColor(colors.textMuted).font("Helvetica").fontSize(10).text(`Category: ${finding.category} | Severity: ${finding.severity}`, margin, currY);
          currY += 15;
          doc.fillColor(colors.textDark).text(`Evidence: ${finding.evidence}`, margin, currY);
          currY += 15;
          doc.fillColor(colors.textDark).text(`Recommendation: ${finding.recommendation}`, margin, currY);
          currY += 30;

          if (currY > doc.page.height - 100) {
            doc.addPage();
            currY = margin;
          }
        });
      } else {
        doc.fillColor(colors.textDark).font("Helvetica").fontSize(10).text("No major technical issues detected.", margin, currY);
      }

      // Disclaimer
      doc.fillColor(colors.textMuted)
        .font("Helvetica")
        .fontSize(8)
        .text(
          "Disclaimer: This report is based entirely on automated technical checks. Scores and findings are generated from publicly observable data at the time of the scan. Information may be unverified.",
          margin,
          doc.page.height - 50,
          { width: pageW - margin * 2, align: "center", lineGap: 4 }
        );

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
