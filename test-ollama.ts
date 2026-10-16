import { generateObject } from "ai";
import { createOllama } from "ollama-ai-provider";
import { z } from "zod";

async function test() {
  const ollama = createOllama({ baseURL: "http://127.0.0.1:11434/api" });
  
  console.log("Attempting to call local qwen3:latest via Ollama...");
  try {
    const { object } = await generateObject({
      model: ollama("qwen3:latest"),
      schema: z.object({ success: z.boolean() }),
      prompt: "Reply with success: true",
      maxRetries: 1
    });
    console.log("Success! Response:", object);
  } catch (error: any) {
    console.error("API Call Failed:");
    if (error.cause) console.error("Cause:", error.cause);
    if (error.data) console.error("Data:", JSON.stringify(error.data, null, 2));
    console.error(error.message || error);
  }
}

test();
