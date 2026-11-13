/**
 * Deep structural equality check for primitives, arrays, and objects.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  // Handle float comparisons with tolerance
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) < 1e-6;
  }

  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;

  // Array comparison
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  // Object comparison
  if (typeof a === "object" && typeof b === "object") {
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(objB, key) || !deepEqual(objA[key], objB[key])) {
        return false;
      }
    }
    return true;
  }

  return false;
}

/**
 * Normalizes pythonic literals (True/False/None/single quotes) into valid JSON strings.
 */
export function normalizeJsonString(str: string): string {
  return str
    .trim()
    .replace(/'/g, '"')
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/\bNone\b/g, "null");
}

/**
 * Compares actual program output against expected test case output
 * using deep JSON equality, falling back to normalized string equality.
 */
export function areOutputsEqual(actual: string, expected: string): boolean {
  const cleanActual = (actual ?? "").trim();
  const cleanExpected = (expected ?? "").trim();

  // 1. Fast path: exact match
  if (cleanActual === cleanExpected) return true;

  // 2. Try deep JSON parsing and structural equality
  try {
    const parsedActual = JSON.parse(normalizeJsonString(cleanActual));
    const parsedExpected = JSON.parse(normalizeJsonString(cleanExpected));
    if (deepEqual(parsedActual, parsedExpected)) {
      return true;
    }
  } catch {
    // JSON parse failed on one or both, fall through to string normalization
  }

  // 3. Try unquoted string match (e.g. '"hello"' vs 'hello')
  const unquotedActual = cleanActual.replace(/^"|"$/g, "");
  const unquotedExpected = cleanExpected.replace(/^"|"$/g, "");
  if (unquotedActual === unquotedExpected) return true;

  // 4. Normalized whitespace comparison (collapse multiple spaces/newlines)
  const normA = cleanActual.replace(/\s+/g, " ");
  const normB = cleanExpected.replace(/\s+/g, " ");
  if (normA === normB) return true;

  // 5. Compact comparison (remove all whitespace, e.g. "[ 0 , 1 ]" vs "[0,1]")
  const compactA = cleanActual.replace(/\s+/g, "");
  const compactB = cleanExpected.replace(/\s+/g, "");
  if (compactA === compactB) return true;

  // 6. Case-insensitive boolean comparison ("true" vs "True")
  if (compactA.toLowerCase() === compactB.toLowerCase()) return true;

  return false;
}

/**
 * Sanitizes and corrects inferred return types based on actual example outputs.
 * Fixes LLM hallucination where 1D arrays [0, 1] are erroneously classified as 2D arrays int[][].
 */
export function sanitizeReturnType(
  returnType: string,
  examples?: Array<{ output: string }>
): string {
  let s = (returnType || "").toLowerCase().trim();

  // Normalize common type synonyms
  if (s === "number[]" || s === "integer[]" || s === "list<int>" || s === "list[int]") s = "int[]";
  if (s === "number[][]" || s === "integer[][]" || s === "list<list<int>>" || s === "list[list[int]]" || s === "2d array") s = "int[][]";
  if (s === "number" || s === "integer") s = "int";
  if (s === "bool") s = "boolean";
  if (s === "str") s = "string";

  if (!examples || examples.length === 0) return s;

  let has1DArrayOutput = false;
  let has2DArrayOutput = false;
  let hasPrimitiveNumber = false;
  let hasBoolean = false;

  for (const ex of examples) {
    const raw = (ex.output || "").trim();
    if (!raw) continue;

    try {
      const jsonStr = normalizeJsonString(raw);
      const parsed = JSON.parse(jsonStr);

      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && Array.isArray(parsed[0])) {
          has2DArrayOutput = true;
        } else {
          has1DArrayOutput = true;
        }
      } else if (typeof parsed === "number") {
        hasPrimitiveNumber = true;
      } else if (typeof parsed === "boolean") {
        hasBoolean = true;
      }
    } catch {
      // Regex fallback if JSON parsing fails
      if (/^\s*\[\s*\[/.test(raw)) {
        has2DArrayOutput = true;
      } else if (/^\s*\[/.test(raw)) {
        has1DArrayOutput = true;
      } else if (/^(true|false)$/i.test(raw)) {
        hasBoolean = true;
      } else if (/^-?\d+(\.\d+)?$/.test(raw)) {
        hasPrimitiveNumber = true;
      }
    }
  }

  // If examples clearly show 1D array, but returnType is 2D array or scalar
  if (has1DArrayOutput && !has2DArrayOutput) {
    if (s.includes("[][]") || s.includes("list<list") || s.includes("list[list") || s.includes("2d")) {
      return s.includes("string") || s.includes("str") ? "string[]" : "int[]";
    }
    if (s === "int" || s === "boolean" || s === "string") {
      return s === "string" ? "string[]" : "int[]";
    }
  }

  // If examples clearly show 2D array, but returnType is 1D array
  if (has2DArrayOutput && !has1DArrayOutput) {
    if (s === "int[]" || s === "string[]") {
      return s === "string[]" ? "string[][]" : "int[][]";
    }
  }

  // If examples clearly show primitive numbers
  if (hasPrimitiveNumber && !has1DArrayOutput && !has2DArrayOutput) {
    if (s.includes("[]")) return "int";
  }

  // If examples clearly show boolean
  if (hasBoolean && !has1DArrayOutput && !has2DArrayOutput) {
    if (s !== "boolean") return "boolean";
  }

  return s;
}
