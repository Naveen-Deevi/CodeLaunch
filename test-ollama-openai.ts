import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

async function test() {
  const ollama = createOpenAI({ 
    baseURL: "http://127.0.0.1:11434/v1",
    apiKey: "ollama" 
  });
  
  console.log("Attempting to call local qwen3:latest via OpenAI compatibility layer...");
  try {
    const { object } = await generateObject({
      model: ollama("qwen3:latest"),
      schema: z.object({ success: z.boolean() }),
      prompt: "Reply with success: true",
      maxRetries: 1
    });
    console.log("Success! Response:", object);
  } catch (error: any) {
    console.error("API Call Failed:", error.message || error);
  }
}

test();
