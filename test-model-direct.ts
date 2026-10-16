import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const FunctionParameterSchema = z.object({
  name: z.string(),
  type: z.string(),
});

const FunctionSignatureSchema = z.object({
  name: z.string(),
  parameters: z.array(FunctionParameterSchema),
  returnType: z.string(),
});

const OfficialExampleSchema = z.object({
  input: z.string(),
  output: z.string(),
  explanation: z.string().optional(),
});

const GeneratedTestSchema = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  type: z.enum(["normal", "edge", "boundary", "stress"]),
  explanation: z.string().optional(),
});

const StarterCodeSchema = z.object({
  java: z.string(),
  python: z.string(),
  cpp: z.string(),
  javascript: z.string(),
  c: z.string(),
});

const ProblemSchema = z.object({
  title: z.string(),
  description: z.string(),
  constraints: z.array(z.string()),
  inputFormat: z.string().optional(),
  outputFormat: z.string().optional(),
  examples: z.array(OfficialExampleSchema),
  functionSignature: FunctionSignatureSchema,
  starterCode: StarterCodeSchema,
  generatedTests: z.array(GeneratedTestSchema),
});

async function main() {
  const ollama = createOpenAI({ baseURL: "http://127.0.0.1:11434/v1", apiKey: "ollama" });
  
  const problemText = `Two Sum
Given an array of integers nums and an integer target, return the indices of the two numbers such that they add up to target.
You may assume that each input has exactly one solution, and you may not use the same element twice.
Return the answer in any order.
Example 1:
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Example 2:
Input: nums = [3,2,4], target = 6
Output: [1,2]
Example 3:
Input: nums = [3,3], target = 6
Output: [0,1]
Constraints:
- 2 <= nums.length <= 10^5
- -10^9 <= nums[i] <= 10^9
- -10^9 <= target <= 10^9
- Exactly one valid answer exists.`;

  console.log("Calling model...");
  try {
    const { object } = await generateObject({
      model: ollama("qwen2.5:3b"),
      schema: ProblemSchema,
      system: "Parse the problem into the schema.",
      messages: [{ role: "user", content: problemText }],
    });
    console.log(JSON.stringify(object, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
