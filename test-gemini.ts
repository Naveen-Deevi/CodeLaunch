import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("No key");
    return;
  }
  const google = createGoogleGenerativeAI({ apiKey });
  
  try {
    const res = await generateObject({
      model: google("gemini-1.5-flash"),
      schema: z.object({ msg: z.string() }),
      prompt: "Say hi"
    });
    console.log("Success with 1.5-flash:", res.object);
  } catch(e) {
    console.error("1.5-flash Error:", e);
  }

  try {
    const res = await generateObject({
      model: google("gemini-2.5-flash-preview-05-20"),
      schema: z.object({ msg: z.string() }),
      prompt: "Say hi"
    });
    console.log("Success with 2.5-flash:", res.object);
  } catch(e) {
    console.error("2.5-flash Error:", e);
  }
}

test();
