// Test the guessEmailFromDomain logic directly
async function guessEmailFromDomain(website: string): Promise<string | undefined> {
  if (!website) return undefined;
  try {
    const hostname = new URL(website).hostname.replace(/^www\./, "");
    const genericHosts = ["wix.com", "squarespace.com", "weebly.com", "wordpress.com"];
    if (genericHosts.some(g => hostname.endsWith(g))) return undefined;

    const dnsRes = await fetch(`https://dns.google/resolve?name=${hostname}&type=MX`, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(4000),
    });
    if (dnsRes.ok) {
      const dnsData = await dnsRes.json();
      if (dnsData.Status === 0 && dnsData.Answer && dnsData.Answer.length > 0) {
        console.log(`MX record found for ${hostname}:`, dnsData.Answer[0]?.data);
        return `info@${hostname}`;
      } else {
        console.log(`No MX record for ${hostname}`, dnsData);
      }
    }
    return undefined;
  } catch (e) {
    console.error("Error:", e);
    return undefined;
  }
}

async function run() {
  const r1 = await guessEmailFromDomain("http://westchesterfamilydentists.com/");
  console.log("All In One Dental guess:", r1);
  
  const r2 = await guessEmailFromDomain("https://dtlasmile.com");
  console.log("DTLA Smile guess:", r2);
}
run().catch(console.error);
