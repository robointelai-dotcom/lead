import { generateReportPdf } from "./src/lib/pdf-generator";
import fs from "fs";

async function main() {
  const mockReport = {
    name: "Test Report",
    type: "AUDIT",
    data: {
      business: {
        name: "Test Dental with a very very very long name that might wrap",
        location: "123 Test St, NY",
        website: "https://www.testdental.com/?utm_source=local&utm_medium=organic",
        phone: "(555) 123-4567",
        reviewCount: 129,
        rating: 4.9
      },
      websiteChecks: {
        reachable: true,
        httpsEnabled: true,
        cms: "WordPress",
        analyticsDetected: ["Google Analytics"],
        marketingPixelsDetected: ["Meta Pixel"],
        hasChatWidget: true,
        hasSchemaMarkup: true
      },
      checks: {
        hasBrokenLeadForm: false
      },
      performance: {
        mobileLoadTimeSeconds: 2.1
      }
    }
  };

  try {
    const pdf = await generateReportPdf(mockReport);
    fs.writeFileSync("test_output.pdf", pdf.buffer);
    console.log("PDF generated successfully.");
  } catch (err) {
    console.error("PDF generation failed:", err);
  }
}

main();
