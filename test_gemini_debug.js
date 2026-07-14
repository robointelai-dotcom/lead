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
    
    const prompt = `Search the web to find the verified contact email address for the business "Service Plus Plumbing". Their website is https://www.serviceplusplumbingpdx.com/ and phone is (503) 927-4482. Return ONLY the full, exact email address string.`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ googleSearch: {} }],
            generationConfig: { temperature: 0.1 }
        })
    });
    
    if (!res.ok) {
        const errorText = await res.text();
        console.error(`Error ${res.status}: ${errorText}`);
        return;
    }
    
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

test();
