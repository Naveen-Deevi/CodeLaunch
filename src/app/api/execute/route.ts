import { NextResponse } from "next/server";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";

const execPromise = (cmd: string, input: string, timeout = 8000) =>
  new Promise<{ stdout: string; stderr: string; exitCode: number; time: number }>(
    (resolve) => {
      const start = Date.now();
      const child = exec(cmd, { timeout }, (err, stdout, stderr) => {
        resolve({
          stdout: (stdout as string) || "",
          stderr: (stderr as string) || (err && !err.killed ? err.message : "") || "",
          exitCode: err?.code ?? 0,
          time: (Date.now() - start) / 1000,
        });
      });
      if (input && child.stdin) {
        child.stdin.write(input);
        child.stdin.end();
      }
    }
  );

// ─── Python wrapper ───────────────────────────────────────────────────────────

function buildPythonCode(userCode: string, stdin: string): string {
  // Detect if user wrote a class Solution or bare function
  const classMatch = userCode.match(/class\s+Solution[\s\S]*?def\s+([a-zA-Z0-9_]+)\s*\(self/);
  const bareMatch = userCode.match(/^def\s+([a-zA-Z0-9_]+)\s*\(/m);

  const fnName = classMatch?.[1] ?? bareMatch?.[1] ?? null;
  if (!fnName) return userCode; // no wrapping if we can't detect a function

  const runner = classMatch
    ? `
import sys, json as _json, re as _re

_data = sys.stdin.read().strip()
if _data:
    try:
        _data = _re.sub(r'[a-zA-Z0-9_]+\\s*=\\s*', '', _data)
        _parts = []
        _depth = 0
        _cur = []
        for _c in _data:
            if _c in '[(': _depth += 1
            elif _c in '])': _depth -= 1
            if (_c == ',' or _c == '\\n') and _depth == 0:
                _s = ''.join(_cur).strip()
                if _s: _parts.append(_s)
                _cur = []
            else:
                _cur.append(_c)
        _s = ''.join(_cur).strip()
        if _s: _parts.append(_s)
        
        if len(_parts) == 1 and ',' not in _data and '\\n' not in _data and ' ' in _data:
            _parts = _data.split()
            
        _args = [_json.loads(_p.replace("'", '"')) for _p in _parts]
        _sol = Solution()
        _res = getattr(_sol, "${fnName}")(*_args)
        if _res is not None:
            print(_json.dumps(_res, separators=(',', ':')))
    except Exception as _e:
        print(_e, file=sys.stderr)
`
    : `
import sys, json as _json, re as _re

_data = sys.stdin.read().strip()
if _data:
    try:
        _data = _re.sub(r'[a-zA-Z0-9_]+\\s*=\\s*', '', _data)
        _parts = []
        _depth = 0
        _cur = []
        for _c in _data:
            if _c in '[(': _depth += 1
            elif _c in '])': _depth -= 1
            if (_c == ',' or _c == '\\n') and _depth == 0:
                _s = ''.join(_cur).strip()
                if _s: _parts.append(_s)
                _cur = []
            else:
                _cur.append(_c)
        _s = ''.join(_cur).strip()
        if _s: _parts.append(_s)
        
        if len(_parts) == 1 and ',' not in _data and '\\n' not in _data and ' ' in _data:
            _parts = _data.split()
            
        _args = [_json.loads(_p.replace("'", '"')) for _p in _parts]
        _res = ${fnName}(*_args)
        if _res is not None:
            print(_json.dumps(_res, separators=(',', ':')))
    except Exception as _e:
        print(_e, file=sys.stderr)
`;

  return userCode + "\n" + runner;
}

// ─── Java wrapper ─────────────────────────────────────────────────────────────

function buildJavaCode(userCode: string, functionSignature?: any): string {
  // User wrote "class Solution { ... }" — we wrap it with a Main that reads stdin
  const methodMatch = userCode.match(/public\s+([\w\[\]<>, ]+?)\s+([a-zA-Z0-9_]+)\s*\(/);
  if (!methodMatch) return userCode;

  const methodName = methodMatch[2];
  const sig = functionSignature;

  if (!sig) return userCode;

  const params = sig.parameters ?? [];
  const retType = (sig.returnType ?? "").toLowerCase();

  // Build type-aware arg parsers
  const argDecls: string[] = [];
  const argNames: string[] = [];

  params.forEach((p: any, i: number) => {
    const t = (p.type ?? "").toLowerCase().trim();
    if (t === "int[]" || t === "integer[]") {
      argDecls.push(`        String _raw${i} = _parts[${i}].trim();`);
      argDecls.push(`        _raw${i} = _raw${i}.replaceAll("^\\\\[|\\\\]$", "");`);
      argDecls.push(`        int[] ${p.name} = _raw${i}.isEmpty() ? new int[0] : java.util.Arrays.stream(_raw${i}.split(",")).mapToInt(s -> Integer.parseInt(s.trim())).toArray();`);
      argNames.push(p.name);
    } else if (t === "int" || t === "integer") {
      argDecls.push(`        int ${p.name} = Integer.parseInt(_parts[${i}].trim());`);
      argNames.push(p.name);
    } else if (t === "long") {
      argDecls.push(`        long ${p.name} = Long.parseLong(_parts[${i}].trim());`);
      argNames.push(p.name);
    } else if (t === "double" || t === "float") {
      argDecls.push(`        double ${p.name} = Double.parseDouble(_parts[${i}].trim());`);
      argNames.push(p.name);
    } else if (t === "boolean") {
      argDecls.push(`        boolean ${p.name} = Boolean.parseBoolean(_parts[${i}].trim());`);
      argNames.push(p.name);
    } else if (t === "string") {
      argDecls.push(`        String ${p.name} = _parts[${i}].trim().replaceAll("^\"|\"$", "");`);
      argNames.push(p.name);
    } else if (t === "string[]") {
      argDecls.push(`        String _rawS${i} = _parts[${i}].trim().replaceAll("^\\\\[|\\\\]$", "");`);
      argDecls.push(`        String[] ${p.name} = _rawS${i}.isEmpty() ? new String[0] : java.util.Arrays.stream(_rawS${i}.split(",")).map(s -> s.trim().replaceAll("^\"|\"$","")).toArray(String[]::new);`);
      argNames.push(p.name);
    } else {
      // fallback — try int
      argDecls.push(`        int ${p.name} = Integer.parseInt(_parts[${i}].trim());`);
      argNames.push(p.name);
    }
  });

  // Build result printing
  let printResult: string;
  if (retType.includes("int[]") || retType.includes("integer[]")) {
    printResult = `System.out.println(java.util.Arrays.toString(_sol.${methodName}(${argNames.join(", ")})).replace(", ", ","));`;
  } else if (retType.includes("list")) {
    printResult = `System.out.println(_sol.${methodName}(${argNames.join(", ")}).toString().replace(", ", ","));`;
  } else if (retType.includes("boolean")) {
    printResult = `System.out.println(_sol.${methodName}(${argNames.join(", ")}));`;
  } else {
    printResult = `System.out.println(_sol.${methodName}(${argNames.join(", ")}));`;
  }

  const mainClass = `
class _Main {
    public static void main(String[] args) throws Exception {
        java.util.Scanner _sc = new java.util.Scanner(System.in);
        String _input = _sc.useDelimiter("\\\\A").hasNext() ? _sc.next().trim() : "";
        String[] _parts = _splitArgs(_input);
${argDecls.join("\n")}
        Solution _sol = new Solution();
        ${printResult}
    }

    static String[] _splitArgs(String raw) {
        raw = raw.replaceAll("[a-zA-Z0-9_]+\\\\s*=\\\\s*", "");
        java.util.List<String> parts = new java.util.ArrayList<>();
        int depth = 0;
        StringBuilder cur = new StringBuilder();
        for (char c : raw.toCharArray()) {
            if (c == '[' || c == '(') depth++;
            else if (c == ']' || c == ')') depth--;
            if ((c == ',' || c == '\\n') && depth == 0) {
                if (cur.toString().trim().length() > 0) parts.add(cur.toString().trim());
                cur = new StringBuilder();
            } else {
                cur.append(c);
            }
        }
        if (cur.toString().trim().length() > 0) parts.add(cur.toString().trim());
        if (parts.size() == 1 && !raw.contains(",") && !raw.contains("\\n") && raw.contains(" ")) {
            return parts.get(0).split("\\\\s+");
        }
        return parts.toArray(new String[0]);
    }
}
`;

  return userCode + "\n" + mainClass;
}

// ─── C wrapper ────────────────────────────────────────────────────────────────

function buildCCode(userCode: string, functionSignature?: any): string {
  // If user already has a main, run as-is
  if (userCode.includes("int main(")) return userCode;

  const sig = functionSignature;
  if (!sig) return userCode;

  const methodName = sig.name;
  const params = sig.parameters ?? [];
  const retType = (sig.returnType ?? "").toLowerCase();

  const includes = `#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n`;

  // Simple int / int[] support
  const decls: string[] = [];
  const scanLines: string[] = [];
  const argNames: string[] = [];

  params.forEach((p: any) => {
    const t = (p.type ?? "").toLowerCase().trim();
    if (t === "int[]" || t === "int*") {
      decls.push(`    int ${p.name}[100000]; int ${p.name}Size = 0;`);
      scanLines.push(`    while(scanf("%d", &${p.name}[${p.name}Size]) == 1) ${p.name}Size++;`);
      argNames.push(`${p.name}, ${p.name}Size`);
    } else {
      decls.push(`    int ${p.name};`);
      scanLines.push(`    scanf("%d", &${p.name});`);
      argNames.push(p.name);
    }
  });

  let printLine = "";
  if (retType.includes("int[]") || retType.includes("int*")) {
    decls.push(`    int retSize = 0;`);
    printLine = `    int* _res = ${methodName}(${argNames.join(", ")}, &retSize);\n    printf("[");\n    for(int i=0;i<retSize;i++){if(i)printf(",");printf("%d",_res[i]);}\n    printf("]\\n");`;
  } else if (retType.includes("bool")) {
    printLine = `    printf("%s\\n", ${methodName}(${argNames.join(", ")}) ? "true" : "false");`;
  } else {
    printLine = `    printf("%d\\n", ${methodName}(${argNames.join(", ")}));`;
  }

  const mainFn = `\nint main() {\n${decls.join("\n")}\n${scanLines.join("\n")}\n${printLine}\n    return 0;\n}\n`;

  return includes + userCode + mainFn;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const tmpDir = os.tmpdir();
  const id = crypto.randomUUID();
  const workDir = path.join(tmpDir, `codelaunch-${id}`);

  try {
    const { code, language, stdin, wrapCode, functionSignature } = await req.json();

    await fs.mkdir(workDir, { recursive: true });

    let finalCode = code;
    let cmd = "";
    let compileCmd = "";
    let filename = "";

    if (language === "python") {
      filename = "solution.py";
      finalCode = wrapCode ? buildPythonCode(code, stdin) : code;
      cmd = `python3 ${path.join(workDir, filename)}`;
    } else if (language === "java") {
      // Must figure out the class names in the file
      // We use _Main as the main class, Solution stays as Solution
      filename = "Solution.java";
      finalCode = wrapCode ? buildJavaCode(code, functionSignature) : code;
      compileCmd = `javac ${path.join(workDir, filename)} -d ${workDir}`;
      cmd = `java -cp ${workDir} _Main`;
    } else if (language === "c") {
      filename = "solution.c";
      finalCode = wrapCode ? buildCCode(code, functionSignature) : code;
      const outBin = path.join(workDir, "solution_out");
      compileCmd = `gcc ${path.join(workDir, filename)} -o ${outBin} -lm`;
      cmd = outBin;
    } else {
      return NextResponse.json({ error: `Language '${language}' is not supported.` }, { status: 400 });
    }

    await fs.writeFile(path.join(workDir, filename), finalCode, "utf8");

    // Compile step (Java / C)
    if (compileCmd) {
      const compileResult = await execPromise(compileCmd, "", 15000);
      if (compileResult.exitCode !== 0 || compileResult.stderr) {
        return NextResponse.json({
          stdout: "",
          stderr: "",
          compile_output: compileResult.stderr || compileResult.stdout,
          time: compileResult.time.toFixed(3),
          memory: 0,
          status: { id: 6, description: "Compilation Error" },
        });
      }
    }

    // Run step
    const runResult = await execPromise(cmd, stdin || "", 8000);

    return NextResponse.json({
      stdout: runResult.stdout.trim(),
      stderr: runResult.stderr.trim(),
      compile_output: "",
      time: runResult.time.toFixed(3),
      memory: 0,
      status: {
        id: runResult.stderr.trim() || runResult.exitCode !== 0 ? 11 : 3,
        description: runResult.stderr.trim() || runResult.exitCode !== 0 ? "Runtime Error" : "Accepted",
      },
    });
  } catch (err: any) {
    console.error("Execute API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
