import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { sanitizeReturnType } from "@/lib/judge";

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const FunctionParameterSchema = z.object({
  name: z.string().describe("Parameter name"),
  type: z.string().describe("Parameter type in a language-agnostic form (e.g. 'int[]', 'string', 'int')"),
});

const FunctionSignatureSchema = z.object({
  name: z.string().describe("The function/method name"),
  parameters: z.array(FunctionParameterSchema),
  returnType: z.string().describe(
    "Return type in a language-agnostic form (e.g. 'int[]', 'string', 'int', 'boolean'). " +
    "Crucial: Inspect the example output dimensions carefully. A 1D array like [0, 1] is 'int[]', NEVER 'int[][]'. " +
    "Only use 'int[][]' if the output is a 2D matrix like [[1, 2], [3, 4]]."
  ),
});

const OfficialExampleSchema = z.object({
  input: z.string().describe("The raw input string shown in the original problem"),
  output: z.string().describe("The expected output shown in the original problem"),
  explanation: z.string().optional().describe("Explanation shown in the original problem, if any"),
});

const GeneratedTestSchema = z.object({
  input: z.string().describe("The raw input string for the test case"),
  expectedOutput: z.string().describe("The expected output for the test case"),
  type: z.enum(["normal", "edge", "boundary", "stress"]).describe("Category of the test case"),
  explanation: z.string().optional().describe("Why this test case is interesting"),
});

// ── Note: starterCode is intentionally NOT in the AI schema.
// ── We generate it server-side from functionSignature for reliability.

const ProblemSchema = z.object({
  title: z.string().describe("Short, descriptive title for the problem"),
  description: z.string().describe("The full problem description formatted as clean Markdown"),
  constraints: z.array(z.string()).describe("Each constraint as a separate string, e.g. '1 <= n <= 100000'"),
  inputFormat: z.string().optional().describe("Description of input format if explicitly given"),
  outputFormat: z.string().optional().describe("Description of output format if explicitly given"),
  examples: z.array(OfficialExampleSchema).describe(
    "ONLY examples that are explicitly in the original problem statement – do NOT generate new ones here"
  ),
  functionSignature: FunctionSignatureSchema,
});

// ─── Server-side boilerplate generators ──────────────────────────────────────

interface Param { name: string; type: string; }
interface Sig { name: string; parameters: Param[]; returnType: string; }

function toJavaType(t: string): string {
  const s = t.toLowerCase().trim();
  if (s === "int[][]" || s === "integer[][]" || s === "number[][]" || s === "2d array") return "int[][]";
  if (s === "int[]" || s === "integer[]" || s === "number[]") return "int[]";
  if (s === "int" || s === "integer" || s === "number") return "int";
  if (s === "string[]") return "String[]";
  if (s === "string") return "String";
  if (s === "boolean" || s === "bool") return "boolean";
  if (s === "double" || s === "float") return "double";
  if (s === "long") return "long";
  if (s.startsWith("list<int") || s === "list<integer>") return "List<Integer>";
  if (s.startsWith("list<string")) return "List<String>";
  if (s.startsWith("list")) return "List<Object>";
  return t; // fallback: use as-is
}

function toPythonType(t: string): string {
  const s = t.toLowerCase().trim();
  if (s.startsWith("int[][]") || s.startsWith("number[][]") || s === "list<list<int>>" || s === "list[list[int]]") return "List[List[int]]";
  if (s === "int[]" || s === "integer[]" || s === "number[]" || s.includes("list<int")) return "List[int]";
  if (s === "int" || s === "integer" || s === "number") return "int";
  if (s === "string[]" || s.includes("list<string")) return "List[str]";
  if (s === "string") return "str";
  if (s === "boolean" || s === "bool") return "bool";
  if (s === "double" || s === "float") return "float";
  if (s === "long") return "int";
  return "Any";
}

function toCType(t: string): string {
  const s = t.toLowerCase().trim();
  if (s.startsWith("int[][]") || s.startsWith("number[][]")) return "int**";
  if (s === "int[]" || s === "integer[]" || s === "number[]") return "int*";
  if (s === "int" || s === "integer" || s === "number") return "int";
  if (s === "string") return "char*";
  if (s === "boolean" || s === "bool") return "int";
  if (s === "double" || s === "float") return "double";
  if (s === "long") return "long";
  return "int";
}

function generateJavaBoilerplate(sig: Sig): string {
  const retType = toJavaType(sig.returnType);
  const params = sig.parameters
    .map((p) => `${toJavaType(p.type)} ${p.name}`)
    .join(", ");
  return `import java.util.*;\n\nclass Solution {\n    public ${retType} ${sig.name}(${params}) {\n        \n    }\n}`;
}

function generatePythonBoilerplate(sig: Sig): string {
  const retType = toPythonType(sig.returnType);
  const params = sig.parameters
    .map((p) => `${p.name}: ${toPythonType(p.type)}`)
    .join(", ");
  return `from typing import List, Optional, Any\n\nclass Solution:\n    def ${sig.name}(self, ${params}) -> ${retType}:\n        pass`;
}

function generateCBoilerplate(sig: Sig): string {
  const retType = toCType(sig.returnType);
  const params: string[] = [];
  for (const p of sig.parameters) {
    const ct = toCType(p.type);
    params.push(`${ct} ${p.name}`);
    // If it's an array, add a size param
    if (p.type.includes("[]") || p.type.toLowerCase().includes("int*")) {
      params.push(`int ${p.name}Size`);
    }
  }
  // If return type is a pointer, add returnSize param
  const extraReturn = retType.endsWith("*") ? `, int* returnSize` : "";
  return `${retType} ${sig.name}(${params.join(", ")}${extraReturn}) {\n    \n}`;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }

    let body: { problemText?: string; imageBase64?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { problemText, imageBase64 } = body;

    if (!problemText?.trim() && !imageBase64) {
      return NextResponse.json(
        { error: "A problem statement or screenshot is required" },
        { status: 400 }
      );
    }

    if (imageBase64 && !imageBase64.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Invalid image format. Please upload a valid image file." },
        { status: 400 }
      );
    }

    let ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1";
    if (ollamaBaseUrl.endsWith("/api")) {
      ollamaBaseUrl = ollamaBaseUrl.replace("/api", "/v1");
    }

    const ollama = createOpenAI({ baseURL: ollamaBaseUrl, apiKey: "ollama" });

    const systemPrompt = `You are an expert competitive-programming problem parser and test-case generator.

Your job:
1. Parse the given programming problem (text or screenshot).
2. Produce a strongly-typed JSON object that conforms exactly to the requested schema.
3. Extract the correct functionSignature: name, parameter names+types, and returnType in language-agnostic form:
   - CRITICAL: Carefully inspect the example outputs to determine the correct returnType and dimensions.
   - If the example output is a 1D array of integers (e.g. [0, 1] or [1, 2, 3]), returnType MUST be 'int[]'. DO NOT return 'int[][]'.
   - If the example output is a 2D matrix/nested list (e.g. [[1, 2], [3, 4]]), returnType is 'int[][]'.
   - If the example output is a single integer (e.g. 42), returnType is 'int'.
   - If the example output is a boolean (e.g. true/false), returnType is 'boolean'.
   - If the example output is a string (e.g. "hello"), returnType is 'string'.
4. For examples: copy ONLY what is explicitly stated in the problem. Do not invent new examples here.
5. For generatedTests: create 3-7 creative test cases covering normal behaviour, edge cases, boundary values, and at least one stress case. Every test case MUST respect all stated constraints.
6. The expectedOutput in generatedTests must be your best-effort computation of the correct answer.
7. Format the description as clean Markdown.

Important constraints for generatedTests:
- Obey the problem's stated constraints exactly.
- Do NOT include empty arrays/strings if the problem says the input is non-empty.
- Do NOT include values outside the stated ranges.`;

    const messageContent: Array<{ type: string; text?: string; image?: string }> = [];

    if (imageBase64) {
      const base64Data = imageBase64.split(",")[1] || imageBase64;
      messageContent.push({
        type: "text",
        text: problemText?.trim()
          ? `Problem context: ${problemText}\n\nAlso parse the attached screenshot of this programming problem.`
          : "Parse this programming problem from the screenshot.",
      });
      messageContent.push({ type: "image", image: base64Data });
    } else {
      messageContent.push({ type: "text", text: problemText as string });
    }

    const modelName = process.env.OLLAMA_MODEL || "qwen2.5:3b";

    const { object } = await generateObject({
      model: ollama(modelName),
      schema: ProblemSchema,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: messageContent as any,
        },
      ],
    });

    // ── Sanitize returnType based on actual examples to prevent dimensional hallucinations ──
    object.functionSignature.returnType = sanitizeReturnType(
      object.functionSignature.returnType,
      object.examples
    );

    // ── Generate boilerplate server-side from the function signature ──────────
    const sig = object.functionSignature;
    const starterCode = {
      java: generateJavaBoilerplate(sig),
      python: generatePythonBoilerplate(sig),
      c: generateCBoilerplate(sig),
    };

    return NextResponse.json({ ...object, starterCode });
  } catch (error: any) {
    console.error("Parse API error:", error?.message ?? error);

    if (error?.message?.includes("Could not parse") || error?.message?.includes("schema")) {
      return NextResponse.json(
        { error: "We couldn't determine a valid programming problem from this input. Please provide a clearer problem statement." },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: "Unable to process this problem right now. Please try again." },
      { status: 500 }
    );
  }
}
