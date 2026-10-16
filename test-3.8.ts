import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No API key found in env");
    return;
  }
  
  const google = createGoogleGenerativeAI({ apiKey });
  
  console.log("Attempting to call gemini-3.8-flash...");
  try {
    const { object } = await generateObject({
      model: google("gemini-3.8-flash"),
      schema: z.object({ success: z.boolean() }),
      prompt: "Reply with success: true"
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
