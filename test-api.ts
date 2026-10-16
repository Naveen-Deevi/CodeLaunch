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
  
  console.log("Using API key:", apiKey.substring(0, 8) + "...");
  
  try {
    console.log("Attempting to call gemini-2.5-flash...");
    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: z.object({ success: z.boolean() }),
      prompt: "Reply with success: true"
    });
    console.log("Success! Response:", object);
  } catch (error: any) {
    console.error("API Call Failed:");
    if (error.cause) console.error("Cause:", error.cause);
    if (error.data) console.error("Data:", error.data);
    console.error(error.message || error);
    
    // Also try 1.5-flash just in case 2.5 is not available for this key
    try {
      console.log("\nAttempting to call gemini-1.5-flash instead...");
      const { object } = await generateObject({
        model: google("gemini-1.5-flash"),
        schema: z.object({ success: z.boolean() }),
        prompt: "Reply with success: true"
      });
      console.log("Success with 1.5-flash! Response:", object);
    } catch (e2: any) {
      console.error("1.5-flash also failed:", e2.message || e2);
    }
  }
}

test();
