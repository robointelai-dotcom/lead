const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    const integration = await prisma.integration.findFirst({
        where: { provider: "gemini", isActive: true }
    });
    if (!integration || !integration.credentials || !integration.credentials.apiKey) {
        console.error("No gemini key in DB");
        return;
    }
    const apiKey = integration.credentials.apiKey;
    
    const prompt = `Find the verified contact email address for the business "Service Plus Plumbing" located at "12009 NE Marx St, Portland, OR 97220, USA". Their website is https://www.serviceplusplumbingpdx.com/. Return ONLY the full email address. If you cannot find a real working email on the web, return NOT_FOUND.`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ googleSearch: {} }],
            generationConfig: { temperature: 0.1 }
        })
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

test();
