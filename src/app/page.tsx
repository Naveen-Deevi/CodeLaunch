"use client";

import { useState, useRef } from "react";
import {
  Code2,
  Upload,
  X,
  ArrowRight,
  Loader2,
  ImageIcon,
  AlertCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useProblemStore } from "@/store/useProblemStore";

export default function Home() {
  const [problemText, setProblemText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const setCurrentProblem = useProblemStore((state) => state.setCurrentProblem);
  const router = useRouter();

  // ── Image handling ─────────────────────────────────────────────────────────

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, WebP, etc.)");
      return;
    }

    // Validate file size (max 5 MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5 MB");
      return;
    }

    setError(null);
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImageBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Paste from clipboard ───────────────────────────────────────────────────

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setImageFile(file);
          const reader = new FileReader();
          reader.onloadend = () => setImageBase64(reader.result as string);
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  // ── Drag & Drop ────────────────────────────────────────────────────────────

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImageBase64(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // ── Generate challenge ─────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!problemText.trim() && !imageBase64) return;
    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemText, imageBase64 }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to generate challenge. Please try again.");
        return;
      }

      setCurrentProblem(data);
      router.push("/problem/active");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerate = (problemText.trim().length > 0 || !!imageBase64) && !isGenerating;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Topbar ──────────────────────────────────────────────────────────── */}
      <header className="h-14 border-b border-panel-border flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center space-x-2">
          <Code2 className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-white tracking-tight">CodeLaunch</span>
        </div>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-8 h-8",
            },
          }}
        />
      </header>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-2xl flex flex-col space-y-6">
          {/* Heading */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Create a Coding Challenge
            </h1>
            <p className="text-gray-400 text-sm leading-relaxed">
              Paste any programming problem or upload a screenshot. AI will parse it and open an interactive IDE.
            </p>
          </div>

          {/* Input Card */}
          <div
            className="border border-panel-border rounded-lg bg-[#13151c] overflow-hidden"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            {/* Card header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-panel-border bg-black/20">
              <div className="flex items-center space-x-2 text-xs text-gray-400">
                <Code2 className="w-3.5 h-3.5" />
                <span>Problem Statement</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center space-x-1.5 text-xs px-2.5 py-1.5 rounded-md border border-panel-border text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
                >
                  <ImageIcon className="w-3 h-3" />
                  <span>Screenshot</span>
                </button>
              </div>
            </div>

            {/* Textarea */}
            <textarea
              value={problemText}
              onChange={(e) => setProblemText(e.target.value)}
              onPaste={handlePaste}
              placeholder={
                "Paste your problem statement here, or upload a screenshot above.\n\n" +
                "Example:\n" +
                "Given an array of integers nums, return the largest element.\n\n" +
                "Input: [3, 1, 7, 2]\n" +
                "Output: 7\n\n" +
                "Constraints:\n" +
                "1 <= nums.length <= 100000\n" +
                "-100000 <= nums[i] <= 100000"
              }
              rows={10}
              className="w-full px-4 py-3 bg-transparent text-gray-200 placeholder-gray-600 outline-none resize-none font-mono text-sm leading-relaxed"
              spellCheck={false}
            />

            {/* Image preview */}
            {imageBase64 && (
              <div className="px-4 pb-3 pt-2 border-t border-panel-border bg-black/10">
                <div className="flex items-center space-x-3 bg-panel-bg border border-panel-border rounded-md p-2 w-max max-w-full">
                  <img
                    src={imageBase64}
                    alt="Screenshot"
                    className="h-10 w-auto rounded border border-panel-border object-cover"
                  />
                  <span className="text-xs text-gray-300 truncate max-w-xs">
                    {imageFile?.name ?? "screenshot.png"}
                  </span>
                  <button
                    onClick={removeImage}
                    className="ml-auto text-gray-500 hover:text-red-400 transition-colors p-1 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start space-x-2 text-red-400 text-sm bg-red-950/30 border border-red-900/50 rounded-md px-3 py-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={`
              flex items-center justify-center w-full py-3 rounded-lg font-medium text-sm transition-all duration-200
              ${canGenerate
                ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30"
                : "bg-panel-bg border border-panel-border text-gray-500 cursor-not-allowed"
              }
            `}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating challenge…
              </>
            ) : (
              <>
                Generate IDE Environment
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </button>

          {/* Tip */}
          <p className="text-center text-xs text-gray-600">
            You can also paste a screenshot directly into the text area (Ctrl+V / Cmd+V)
          </p>
        </div>
      </main>
    </div>
  );
}
