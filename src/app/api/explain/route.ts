import { NextResponse } from "next/server";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

export async function POST(req: Request) {
  try {
    let body: {
      problem?: { title?: string; description?: string };
      userCode?: string;
      language?: string;
      failedTest?: { input?: string; expectedOutput?: string; actualOutput?: string };
      error?: string;
    };

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { problem, userCode, language, failedTest, error } = body;

    if (!userCode || !language) {
      return NextResponse.json({ error: "userCode and language are required" }, { status: 400 });
    }

    let ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1";
    if (ollamaBaseUrl.endsWith("/api")) ollamaBaseUrl = ollamaBaseUrl.replace("/api", "/v1");
    const ollama = createOpenAI({ baseURL: ollamaBaseUrl, apiKey: "ollama" });

    const prompt = `You are a helpful programming tutor. A student's solution failed. Provide a concise, educational explanation.

Problem: ${problem?.title ?? "Unknown"}
${problem?.description ? `Description: ${problem.description.slice(0, 500)}` : ""}

Language: ${language}

Student's Code:
\`\`\`${language}
${userCode}
\`\`\`

${
  failedTest
    ? `Failed Test Case:
Input: ${failedTest.input ?? "N/A"}
Expected Output: ${failedTest.expectedOutput ?? "N/A"}
Actual Output: ${failedTest.actualOutput ?? "N/A"}`
    : ""
}

${error ? `Compiler/Runtime Error:\n${error}` : ""}

Instructions:
- Explain WHY the solution fails in 2-4 sentences.
- Point to the specific part of the code causing the issue.
- Suggest what the student should think about, NOT the exact fix.
- Do NOT rewrite their entire solution.
- Do NOT give the answer directly.
- Be encouraging and educational.
- Keep the response under 200 words.`;

    const result = await streamText({
      model: ollama("qwen2.5:3b"),
      prompt,
      maxOutputTokens: 400,
    });

    // Return as streaming response
    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("Explain API error:", error?.message ?? error);
    return NextResponse.json(
      { error: "Unable to generate explanation right now. Please try again." },
      { status: 500 }
    );
  }
}
