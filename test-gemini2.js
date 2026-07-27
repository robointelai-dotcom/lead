const apiKey = "DUMMY_KEY";
fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [{ parts: [{ text: "hi" }] }]
  })
}).then(async r => console.log(r.status, await r.text()));
