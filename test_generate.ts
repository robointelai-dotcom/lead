import { generateReportPdf } from "./src/lib/pdf-generator";
import * as fs from "fs";

async function run() {
  const data = {
    business: {
      name: "Tribeca Dental Care",
      location: "128 Main St Suite 2, Somerville, NJ 08876",
      website: "tribecadentaloffice.com",
      phone: "(212) 431-4582"
    },
    performance: {
      mobileLoadTimeSeconds: 4.1
    }
  };

  const pdf = await generateReportPdf({
    name: "Test Report",
    type: "AI Growth Readiness",
    data
  });

  fs.writeFileSync("test-output.pdf", pdf.buffer);
  console.log("Saved test-output.pdf");
}

run().catch(console.error);
