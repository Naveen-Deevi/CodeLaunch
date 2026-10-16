"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import Editor from "@monaco-editor/react";
import {
  Play,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  RotateCcw,
  Sparkles,
  ChevronDown,
  AlertCircle,
  Code2,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { useProblemStore, ProblemData } from "@/store/useProblemStore";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

// ─── Types ────────────────────────────────────────────────────────────────────

type Language = "java" | "python" | "c";

interface TestResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  time?: string;
  memory?: number;
  stderr?: string;
  compileOutput?: string;
  status?: { id: number; description: string };
}

interface SubmitResult {
  verdict: "Accepted" | "Wrong Answer" | "Compilation Error" | "Runtime Error" | "Time Limit Exceeded" | "Memory Limit Exceeded" | "Unknown";
  totalTests: number;
  passedTests: number;
  failedTest?: TestResult;
  time?: string;
}

const LANGUAGE_LABELS: Record<Language, string> = {
  java: "Java",
  python: "Python 3",
  c: "C",
};

const MONACO_LANGUAGE_MAP: Record<Language, string> = {
  java: "java",
  python: "python",
  c: "c",
};

const FILE_EXTENSION: Record<Language, string> = {
  java: "java",
  python: "py",
  c: "c",
};

// ─── Helper: render execution status badge ────────────────────────────────────

function StatusBadge({ description }: { description: string }) {
  const isOk = description === "Accepted";
  const isCompileError = description.toLowerCase().includes("compile");
  const isRuntime = description.toLowerCase().includes("runtime") || description.toLowerCase().includes("signal");
  const isTle = description.toLowerCase().includes("time");
  const isMle = description.toLowerCase().includes("memory");

  let color = "text-red-400 bg-red-950/40 border-red-900/50";
  if (isOk) color = "text-emerald-400 bg-emerald-950/40 border-emerald-900/50";
  else if (isCompileError) color = "text-orange-400 bg-orange-950/40 border-orange-900/50";
  else if (isRuntime) color = "text-red-400 bg-red-950/40 border-red-900/50";
  else if (isTle) color = "text-yellow-400 bg-yellow-950/40 border-yellow-900/50";
  else if (isMle) color = "text-purple-400 bg-purple-950/40 border-purple-900/50";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${color}`}>
      {description}
    </span>
  );
}

// ─── Helper: simple markdown-ish renderer ─────────────────────────────────────

function ProblemDescription({ problem }: { problem: ProblemData }) {
  return (
    <div className="flex-1 overflow-y-auto p-5">
      <h1 className="text-xl font-bold text-white mb-4">{problem.title}</h1>

      {/* Description */}
      <div
        className="problem-prose text-sm mb-5"
        dangerouslySetInnerHTML={{
          __html: markdownToHtml(problem.description),
        }}
      />

      {/* Examples */}
      {problem.examples.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
            Examples
          </h2>
          <div className="space-y-3">
            {problem.examples.map((ex, i) => (
              <div key={i} className="bg-black/30 border border-white/6 rounded-md p-3 space-y-2">
                <div>
                  <div className="text-xs text-gray-500 font-medium mb-1">Input</div>
                  <code className="text-xs text-blue-300 font-mono whitespace-pre-wrap block">{ex.input}</code>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-medium mb-1">Output</div>
                  <code className="text-xs text-emerald-300 font-mono whitespace-pre-wrap block">{ex.output}</code>
                </div>
                {ex.explanation && (
                  <div className="text-xs text-gray-400 mt-1 pt-2 border-t border-white/5">
                    {ex.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Constraints */}
      {problem.constraints.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
            Constraints
          </h2>
          <ul className="space-y-1">
            {problem.constraints.map((c, i) => (
              <li key={i} className="text-xs text-gray-400 font-mono flex items-start space-x-2">
                <span className="text-gray-600 shrink-0">•</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Function signature */}
      {problem.functionSignature && (
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
            Function Signature
          </h2>
          <div className="bg-black/30 border border-white/6 rounded-md p-3 font-mono text-xs text-blue-300">
            {problem.functionSignature.returnType} {problem.functionSignature.name}(
            {problem.functionSignature.parameters.map((p) => `${p.type} ${p.name}`).join(", ")}
            )
          </div>
        </div>
      )}
    </div>
  );
}

// Very simple markdown → html converter (no external deps)
function markdownToHtml(md: string): string {
  if (!md) return "";
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/```[\w]*\n([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^\s*[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[^<]*<\/li>(\n<li>[^<]*<\/li>)*)/g, "<ul>$1</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hupol])(.+)$/gm, "<p>$1</p>")
    .replace(/<p><\/p>/g, "")
    .replace(/<p>(<[hupol])/g, "$1")
    .replace(/(<\/[hupol][^>]*>)<\/p>/g, "$1");
}

// ─── Console / Results Panel ──────────────────────────────────────────────────

interface ConsolePanelProps {
  problem: ProblemData;
  activeTab: "testcases" | "result";
  setActiveTab: (t: "testcases" | "result") => void;
  isRunning: boolean;
    runResult: SubmitResult | null;
    onExplain: () => void;
  explanation: string | null;
  isExplaining: boolean;
}

function ConsolePanel({
  problem,
  activeTab,
  setActiveTab,
  isRunning,
    runResult,
    onExplain,
  explanation,
  isExplaining,
}: ConsolePanelProps) {
  return (
    <div className="h-full flex flex-col bg-[#13151a]">
      {/* Tabs */}
      <div className="flex items-center h-9 px-2 border-b border-panel-border shrink-0">
        {(["testcases", "result"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? "border-blue-500 text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab === "testcases" ? "Test Cases" : "Results"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* ── Test Cases Tab ── */}
        {activeTab === "testcases" && (
          <div className="space-y-4">
            {problem.examples.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wider">
                  Official Examples
                </div>
                <div className="space-y-2">
                  {problem.examples.map((ex, i) => (
                    <div key={i} className="bg-black/30 border border-white/6 rounded-md p-3 space-y-2">
                      <div className="text-xs font-medium text-gray-400">Example {i + 1}</div>
                      <div>
                        <div className="text-xs text-gray-600 mb-0.5">Input</div>
                        <code className="text-xs text-blue-300 font-mono whitespace-pre-wrap block">{ex.input}</code>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600 mb-0.5">Expected Output</div>
                        <code className="text-xs text-emerald-300 font-mono whitespace-pre-wrap block">{ex.output}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}


          </div>
        )}

        {/* ── Results Tab ── */}
        {activeTab === "result" && (
          <div className="space-y-4">
            {isRunning && (
              <div className="flex flex-col items-center justify-center py-10 space-y-2 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                <span className="text-sm">{"Running test cases…"}</span>
              </div>
            )}

            {!isRunning && !runResult && (
              <div className="flex flex-col items-center justify-center py-10 space-y-2 text-gray-600">
                <Cpu className="w-6 h-6 opacity-40" />
                <span className="text-sm">Run or submit your code to see results</span>
              </div>
            )}

            {/* Run result (multi-test) */}
            {!isRunning && runResult && (
              <div className="space-y-4">
                {/* Verdict */}
                <div className={`flex items-start space-x-3 p-3 rounded-md border ${
                  runResult.verdict === "Accepted"
                    ? "bg-emerald-950/30 border-emerald-900/50"
                    : "bg-red-950/30 border-red-900/50"
                }`}>
                  {runResult.verdict === "Accepted"
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    : <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
                  <div>
                    <div className={`text-base font-bold ${
                      runResult.verdict === "Accepted" ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {runResult.verdict}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {runResult.passedTests} / {runResult.totalTests} test cases passed
                      {runResult.time && ` · Runtime: ${runResult.time}s`}
                    </div>
                  </div>
                </div>

                {/* Failed test details */}
                {runResult.failedTest && (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                      Failed Test Case
                    </div>
                    <TestResultDetails result={runResult.failedTest} />

                    {/* Explain failure */}
                    <div className="pt-1">
                      <button
                        onClick={onExplain}
                        disabled={isExplaining}
                        className="flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-md border border-panel-border text-gray-400 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-50"
                      >
                        {isExplaining ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        <span>{isExplaining ? "Analyzing…" : "Explain Failure"}</span>
                      </button>
                    </div>

                    {explanation && (
                      <div className="bg-blue-950/20 border border-blue-900/30 rounded-md p-3 text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {explanation}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TestResultDetails({ result }: { result: TestResult }) {
  return (
    <div className="space-y-2 text-xs">
      {result.compileOutput && (
        <div>
          <div className="text-orange-400 font-medium mb-1">Compilation Error</div>
          <pre className="bg-black/40 border border-orange-900/30 rounded p-2 text-orange-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
            {result.compileOutput}
          </pre>
        </div>
      )}
      {result.stderr && (
        <div>
          <div className="text-red-400 font-medium mb-1">Runtime Error</div>
          <pre className="bg-black/40 border border-red-900/30 rounded p-2 text-red-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
            {result.stderr}
          </pre>
        </div>
      )}
      {!result.compileOutput && !result.stderr && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-gray-500 mb-1">Input</div>
              <div className="bg-black/30 border border-white/5 rounded p-2 font-mono text-[11px] text-blue-300 whitespace-pre-wrap">
                {result.input || "(empty)"}
              </div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Expected</div>
              <div className="bg-black/30 border border-white/5 rounded p-2 font-mono text-[11px] text-emerald-300 whitespace-pre-wrap">
                {result.expectedOutput || "(empty)"}
              </div>
            </div>
          </div>
          <div>
            <div className={`mb-1 ${result.passed ? "text-gray-500" : "text-red-400"}`}>
              Your Output
            </div>
            <div className={`bg-black/30 border rounded p-2 font-mono text-[11px] whitespace-pre-wrap ${
              result.passed ? "border-white/5 text-gray-300" : "border-red-900/30 text-red-300"
            }`}>
              {result.actualOutput || "(no output)"}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Workspace Component ─────────────────────────────────────────────────

export default function Workspace() {
  const currentProblem = useProblemStore((state) => state.currentProblem);
  const router = useRouter();

  const [language, setLanguage] = useState<Language>("python");
  const [code, setCode] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"testcases" | "result">("testcases");
  const [isRunning, setIsRunning] = useState(false);
    const [runResult, setRunResult] = useState<SubmitResult | null>(null);
    const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  const originalCodeRef = useRef<string>("");

  // Redirect if no problem loaded
  useEffect(() => {
    if (!currentProblem) {
      router.push("/");
    }
  }, [currentProblem, router]);

  // Load starter code when problem or language changes
  useEffect(() => {
    if (currentProblem) {
      const starter = currentProblem.starterCode[language] ?? "";
      setCode(starter);
      originalCodeRef.current = starter;
    }
  }, [currentProblem, language]);

  const handleLanguageChange = useCallback((lang: Language) => {
    setLanguage(lang);
    setLangDropdownOpen(false);
    setRunResult(null);
        setExplanation(null);
  }, []);

  const handleResetCode = useCallback(() => {
    if (currentProblem) {
      const starter = currentProblem.starterCode[language] ?? "";
      setCode(starter);
    }
  }, [currentProblem, language]);

  // ── Execute helper ────────────────────────────────────────────────────────

  const executeCode = useCallback(
    async (stdin: string): Promise<TestResult & { rawStatus?: any }> => {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, stdin, wrapCode: true, functionSignature: currentProblem.functionSignature }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Execution failed");
      }

      const data = await response.json();
      const stdout = (data.stdout ?? "").trim();
      const stderr = (data.stderr ?? "").trim();
      const compileOutput = (data.compile_output ?? "").trim();

      return {
        input: stdin,
        expectedOutput: "",
        actualOutput: stdout,
        passed: false,
        time: data.time,
        memory: data.memory,
        stderr: stderr || undefined,
        compileOutput: compileOutput || undefined,
        status: data.status,
        rawStatus: data.status,
      };
    },
    [code, language]
  );

  // ── Run ───────────────────────────────────────────────────────────────────

  
  // ── Submit ────────────────────────────────────────────────────────────────

  
  const handleRun = useCallback(async () => {
    if (!currentProblem) return;
    setIsRunning(true);
    setActiveTab("result");
    setRunResult(null);
    setExplanation(null);

    const allTests = currentProblem.examples.map((e) => ({
      input: e.input,
      expected: e.output,
    }));

    let passedCount = 0;
    let failedTestResult: TestResult | undefined;
    let lastTime: string | undefined;

    try {
      for (const tc of allTests) {
        const result = await executeCode(tc.input);
        lastTime = result.time;

        const isCompileOrRuntime = !!result.compileOutput || (result.status?.id ?? 0) > 3;

        if (isCompileOrRuntime) {
          const verdict = result.compileOutput
            ? "Compilation Error"
            : result.status?.description?.includes("Time")
            ? "Time Limit Exceeded"
            : result.status?.description?.includes("Memory")
            ? "Memory Limit Exceeded"
            : "Runtime Error";

          setRunResult({
            verdict: verdict as SubmitResult["verdict"],
            totalTests: allTests.length,
            passedTests: passedCount,
            failedTest: {
              ...result,
              expectedOutput: tc.expected,
              passed: false,
            },
            time: lastTime,
          });
          return;
        }

        const passed = result.actualOutput.trim() === tc.expected.trim();
        if (passed) {
          passedCount++;
        } else if (!failedTestResult) {
          failedTestResult = {
            ...result,
            expectedOutput: tc.expected,
            passed: false,
          };
        }
      }

      const allPassed = passedCount === allTests.length;
      setRunResult({
        verdict: allPassed ? "Accepted" : "Wrong Answer",
        totalTests: allTests.length,
        passedTests: passedCount,
        failedTest: failedTestResult,
        time: lastTime,
      });
    } catch (err: any) {
      setRunResult({
        verdict: "Unknown",
        totalTests: allTests.length,
        passedTests: passedCount,
        failedTest: {
          input: "",
          expectedOutput: "",
          actualOutput: "",
          passed: false,
          stderr: err.message,
        },
        time: lastTime,
      });
    } finally {
      setIsRunning(false);
    }
  }, [currentProblem, executeCode]);

  // ── Explain failure ───────────────────────────────────────────────────────

  const handleExplain = useCallback(async () => {
    if (!currentProblem || !runResult?.failedTest) return;
    setIsExplaining(true);
    setExplanation(null);

    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: {
            title: currentProblem.title,
            description: currentProblem.description,
          },
          userCode: code,
          language,
          failedTest: {
            input: runResult.failedTest.input,
            expectedOutput: runResult.failedTest.expectedOutput,
            actualOutput: runResult.failedTest.actualOutput,
          },
          error:
            runResult.failedTest.stderr || runResult.failedTest.compileOutput,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setExplanation(err.explanation ?? "Failed to generate explanation.");
        return;
      }

      // Handle streaming or JSON response
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("text/event-stream") || contentType.includes("text/plain")) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let result = "";
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            // Parse SSE or plain text
            for (const line of chunk.split("\n")) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (data === "[DONE]") break;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.text) result += parsed.text;
                  else if (typeof parsed === "string") result += parsed;
                } catch {
                  result += data;
                }
              } else if (!line.startsWith(":") && line.trim()) {
                result += line;
              }
            }
          }
          setExplanation(result.trim() || "No explanation generated.");
        }
      } else {
        const data = await response.json();
        setExplanation(data.explanation ?? "No explanation generated.");
      }
    } catch (err: any) {
      setExplanation("Failed to get explanation: " + err.message);
    } finally {
      setIsExplaining(false);
    }
  }, [currentProblem, runResult, code, language]);

  // ─── Render ────────────────────────────────────────────────────────────────

  if (!currentProblem) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-background overflow-hidden">
      {/* ── Topbar ──────────────────────────────────────────────────────────── */}
      <header className="h-12 border-b border-panel-border bg-[#0d0f16] flex items-center justify-between px-4 shrink-0">
        {/* Left: Brand + problem title */}
        <div className="flex items-center space-x-3 min-w-0">
          <button
            onClick={() => router.push("/")}
            className="flex items-center space-x-1.5 text-gray-500 hover:text-gray-300 transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center space-x-2 shrink-0">
            <Code2 className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">CodeLaunch</span>
          </div>
          <div className="h-4 w-px bg-panel-border shrink-0" />
          <span className="text-sm text-gray-400 truncate">{currentProblem.title}</span>
        </div>

        {/* Right: Language selector + Run + Submit + User */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Language dropdown */}
          <div className="relative">
            <button
              onClick={() => setLangDropdownOpen((o) => !o)}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-panel-bg border border-panel-border rounded-md text-xs text-gray-300 hover:border-gray-600 transition-colors"
            >
              <span>{LANGUAGE_LABELS[language]}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {langDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 bg-[#1a1d27] border border-panel-border rounded-md overflow-hidden z-50 shadow-xl min-w-[140px]">
                {(Object.entries(LANGUAGE_LABELS) as [Language, string][]).map(([lang, label]) => (
                  <button
                    key={lang}
                    onClick={() => handleLanguageChange(lang)}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                      lang === language
                        ? "bg-blue-600/20 text-blue-300"
                        : "text-gray-300 hover:bg-white/5"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reset code */}
          <button
            onClick={handleResetCode}
            title="Reset to starter code"
            className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors rounded-md hover:bg-white/5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-panel-border" />

          {/* Run */}
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-panel-bg border border-panel-border rounded-md text-xs text-gray-300 hover:bg-white/5 hover:border-gray-600 transition-colors disabled:opacity-50"
          >
            {isRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>Run</span>
          </button>

          {/* Submit */}
          

          <UserButton
            appearance={{ elements: { avatarBox: "w-7 h-7" } }}
          />
        </div>
      </header>

      {/* ── Main layout ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup orientation="horizontal" className="h-full">

          {/* Left: Problem description */}
          <Panel defaultSize={38} minSize={22} className="bg-[#11131a]">
            <ProblemDescription problem={currentProblem} />
          </Panel>

          <PanelResizeHandle className="w-1 bg-panel-border hover:bg-blue-600/40 transition-colors cursor-col-resize" />

          {/* Right: Editor + Console */}
          <Panel defaultSize={62} minSize={30}>
            <PanelGroup orientation="vertical">

              {/* Editor */}
              <Panel defaultSize={68} minSize={25} className="relative">
                {/* Editor tab bar */}
                <div className="absolute top-0 left-0 right-0 h-9 bg-[#1e1e1e] border-b border-[#2d2d2d] z-10 flex items-center px-4">
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <Code2 className="w-3 h-3" />
                    <span className="font-mono">
                      Solution.{FILE_EXTENSION[language]}
                    </span>
                  </div>
                </div>
                <div className="h-full pt-9">
                  <Editor
                    height="100%"
                    language={MONACO_LANGUAGE_MAP[language]}
                    theme="vs-dark"
                    value={code}
                    onChange={(val) => setCode(val ?? "")}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: "var(--font-mono), 'Cascadia Code', 'Fira Code', monospace",
                      fontLigatures: true,
                      lineNumbers: "on",
                      padding: { top: 12, bottom: 12 },
                      scrollBeyondLastLine: false,
                      smoothScrolling: true,
                      cursorBlinking: "smooth",
                      renderLineHighlight: "line",
                      tabSize: language === "python" ? 4 : 4,
                      insertSpaces: true,
                      wordWrap: "off",
                      bracketPairColorization: { enabled: true },
                      automaticLayout: true,
                    }}
                  />
                </div>
              </Panel>

              <PanelResizeHandle className="h-1 bg-panel-border hover:bg-blue-600/40 transition-colors cursor-row-resize" />

              {/* Console */}
              <Panel defaultSize={32} minSize={15}>
                <ConsolePanel
                  problem={currentProblem}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  isRunning={isRunning}
                  runResult={runResult}
                  onExplain={handleExplain}
                  explanation={explanation}
                  isExplaining={isExplaining}
                />
              </Panel>

            </PanelGroup>
          </Panel>

        </PanelGroup>
      </div>

      {/* Click-away to close dropdown */}
      {langDropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setLangDropdownOpen(false)}
        />
      )}
    </div>
  );
}
