# CodeLaunch

CodeLaunch is an AI-powered platform that converts any programming problem into a LeetCode-style interactive coding environment — complete with a structured problem description, constraints, examples, and a multi-language Monaco editor workspace.

## Requirements

- Node.js 18+
- A [Clerk](https://clerk.com) account (for authentication)
- A local [Ollama](https://ollama.com/) instance running the `qwen2.5:3b` model (for problem parsing and AI hints).

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the values below into `.env.local` and fill in your keys:

```env
# Clerk — https://dashboard.clerk.com → your app → API Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Ollama - Base URL for the local Ollama instance (default)
OLLAMA_BASE_URL=http://127.0.0.1:11434/api
```

### 3. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

```
User
 ↓
CodeLaunch (Next.js 16 / App Router)
 ↓
Landing page — paste or type a problem
 ↓
POST /api/parse  →  Local Ollama / Qwen 2.5:3b (problem structuring)
 ↓
Structured problem stored in Zustand
 ↓
/problem/[id] workspace
 ↓
Monaco Editor (Java · Python · C++ · JavaScript · C)
 ↓
POST /api/execute  →  503 — execution temporarily unavailable
```

Code execution is not currently wired. `/api/execute` returns a `503` response. A real execution provider will be added in a future release.

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **Auth**: Clerk v7
- **AI**: Vercel AI SDK + Local Ollama (Qwen 2.5:3b)
- **Editor**: Monaco Editor
- **State**: Zustand
- **Panels**: react-resizable-panels
