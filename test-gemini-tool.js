const apiKey = process.env.GEMINI_API_KEY || "DUMMY_KEY";
const body = {
  contents: [{ parts: [{ text: "hi" }] }],
  tools: [{ google_search_retrieval: { dynamic_retrieval_config: { mode: "MODE_DYNAMIC", dynamic_threshold: 0.3 } } }]
};
console.log(JSON.stringify(body));
