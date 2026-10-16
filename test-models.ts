import { createGoogleGenerativeAI } from "@ai-sdk/google";

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json();
  console.log("Models:", data.models.map(m => m.name).filter(n => n.includes("gemini")));
}
test();
