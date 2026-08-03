import { generateReportPdf } from "./src/lib/pdf-generator";
import fs from "fs";
const pdf = require("pdf-parse");

async function main() {
  const mockReport = {
    name: "QA Test Report",
    type: "AUDIT",
    data: {
      business: {
        name: "QA Dental Test",
        location: "999 QA St, CA",
        website: "https://www.qadental.com",
        phone: "(555) 999-9999",
        reviewCount: 42,
        rating: 3.8
      },
      websiteChecks: {
        reachable: true,
        httpsEnabled: false, // deliberate test
        cms: "Unknown", // deliberate test
        analyticsDetected: [], // deliberate test
        marketingPixelsDetected: [], // deliberate test
        hasChatWidget: false,
        hasSchemaMarkup: false
      },
      checks: {
        hasBrokenLeadForm: true // deliberate test
      },
      performance: {
        mobileLoadTimeSeconds: 6.2
      }
    }
  };

  try {
    console.log("Generating QA PDF...");
    const pdfBuffer = await generateReportPdf(mockReport);
    fs.writeFileSync("qa_test_output.pdf", pdfBuffer.buffer);
    console.log("PDF generated. Parsing text...");
    
    const parsed = await pdf(pdfBuffer.buffer);
    const text = parsed.text;
    
    const badWords = [
      "Audit Req.",
      "Needs Audit",
      "Action required",
      "Dummy",
      "Placeholder",
      "[object Object]",
      "NaN",
      "undefined",
      "null"
    ];
    
    let foundIssues = false;
    
    for (const word of badWords) {
      if (text.includes(word)) {
        console.error(`❌ FAILED: Found restricted placeholder word in PDF text: "${word}"`);
        foundIssues = true;
      }
    }
    
    if (!foundIssues) {
      console.log("✅ PASSED: No restricted placeholder words found.");
    }
    
    // Output a snippet of the text to confirm it's readable
    console.log("--- TEXT SNIPPET ---");
    console.log(text.substring(0, 500));
    console.log("--------------------");

  } catch (err) {
    console.error("❌ QA PDF Test failed with exception:", err);
  }
}

main();
