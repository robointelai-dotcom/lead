const apiKey = process.env.GEMINI_API_KEY || "DUMMY_KEY";
fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [{ parts: [{ text: "hi" }] }],
    tools: [{ googleSearch: {} }]
  })
}).then(async r => console.log(r.status, await r.text()));
