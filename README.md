# LaunchLens AI

LaunchLens AI is a Cloudflare-native application for pressure-testing an AI product idea and turning it into a reviewer-ready launch pack. The frontend is built with React, TypeScript, Tailwind CSS, and Vite, while the backend runs on a Cloudflare Worker with Workers AI, a Durable Object, and Workflows. A reviewer lands on a focused product page first, enters a dedicated workspace second, then types or speaks an idea, refines it over chat, builds a concept preview plus launch strategy, and refreshes to confirm the session state persists.

This project was built for Cloudflare's AI-powered application assignment and is designed to be easy to understand and demo immediately.

## Primary Use Case

This app is meant for the moment when an idea is still fuzzy but you want something more concrete than notes:

- a founder wants to pressure-test a product concept
- a product person wants a fast prototype direction
- a reviewer wants to see chat, memory, workflow orchestration, and generated output in one app

Instead of stopping at conversation, the app turns the idea into a structured brief, a concept preview, and a 30-day launch pack.

## Assignment Fit

This project satisfies each required component from the assignment:

| Assignment requirement | How this project satisfies it |
| --- | --- |
| `LLM` | Uses `Llama 3.3` on `Workers AI` for the live product-strategy chat in `src/ai.ts`. |
| `Workflow / coordination` | Uses a `Worker` for orchestration, a `Durable Object` for per-session coordination and persistence, and a `Workflow` for asynchronous launch-pack generation in `src/index.ts`. |
| `User input via chat or voice` | Provides a React chat workspace with starter prompts, streaming responses, and browser-based voice input in `app/src/App.tsx`. |
| `Memory or state` | Stores chat history, extracted product fields, workflow status, and generated artifacts in a persistent `Durable Object` session. |

## What The App Does

The app acts like an AI product strategist and launch copilot:

- the user enters or speaks a rough startup or product idea
- the assistant helps sharpen audience, problem, solution, MVP, and risks
- the app derives and stores a structured "Launch Snapshot" after each chat turn
- the user triggers a background workflow that assembles a launch brief, checklist, forecast, and a deterministic concept preview from the saved snapshot
- the same session reloads after refresh because the state is stored server-side and the browser keeps the session id locally

## Architecture

### Frontend

- React + TypeScript single-page frontend built with Vite
- Tailwind CSS interface with a dedicated landing page and separate workspace route
- Guided chat interface with starter prompts
- Voice input using the browser's speech recognition API when available
- Streaming assistant responses over SSE
- Persistent browser session id in local storage
- Live Launch Snapshot panel derived from the conversation
- Workflow status and generated concept-preview display

### Backend

- `POST /api/chat`
  - appends the user message to the session
  - streams the AI response back to the browser
  - persists the assistant response before the stream finishes
  - returns the updated session state so the UI stays in sync without extra fetch loops
- `GET /api/state`
  - returns the persisted project state for the current session
- `POST /api/generate-brief`
  - validates that the session has user input
  - starts a Cloudflare Workflow run against the saved snapshot
  - produces a concept preview, launch brief, forecast, and checklist from the saved state
- `POST /api/reset`
  - clears the session so the reviewer can start over

### Cloudflare services used

- `Workers AI`
- `Durable Objects`
- `Workflows`
- `Worker static assets`

## Running Locally

### Prerequisites

- Node.js `18+`
- A Cloudflare account with `Workers AI` access
- Wrangler CLI access through the project dependency
- Cloudflare authentication configured locally, for example with:

```bash
npx wrangler login
```

### Install

```bash
npm install
```

### Generate Worker Types

```bash
npm run cf-typegen
```

### Start The App

```bash
npm run dev
```

The local app runs at `http://localhost:8787`.

## Quick Demo Flow

1. Open `http://localhost:8787`.
2. Click `Open Workspace` or choose a starter prompt.
3. Chat for a few turns until the `Launch Snapshot` fills in.
4. Optionally use `Voice` to dictate a product idea or follow-up.
5. Click `Build Launch Pack`.
6. Wait for the workflow to finish and inspect the concept preview, launch brief, forecast, and checklist.
7. Refresh the page to confirm that the session state persists.
8. Click `New Session` to reset and return to the landing page.

## Verification

These checks were run during implementation:

```bash
npm test -- --run
npm run check
```

What those checks cover:

- TypeScript compilation
- Vite production build for the React + Tailwind frontend
- Wrangler dry-run build
- UI smoke tests for the main landing-page and workspace actions, including `Open Workspace`, sample-prompt handoff, chat send, launch-pack generation, `Back To Landing`, and `New Session`
- State transition tests for message persistence, snapshot merging, workflow completion, stale workflow protection, and reset behavior

## Reliability Notes

- The chat path uses one LLM call for the streamed assistant response.
- The live launch snapshot is derived locally from the saved conversation to avoid adding a second inference call after every message.
- The streamed chat response now finalizes session state before the stream closes, which removes the extra post-chat sync loop from the frontend.
- The workflow renders the launch pack deterministically from the saved session state, which avoids the timeout-prone "generate a whole site" pattern and keeps the demo fast.
- Voice input uses the browser Web Speech API, so support depends on the browser.

Note: in sandboxed environments Wrangler may print a warning about writing logs under `~/.wrangler`, but the build and dry-run can still complete successfully.

## Project Structure

```text
app/
  index.html      Vite entry HTML
  src/App.tsx     Landing page, workspace route, and client state flow
  src/components/ Reusable markdown and forecast UI components
  src/lib/types.ts Frontend API and state types
  src/styles.css  Tailwind theme and utility layers
src/
  ai.ts           Workers AI chat prompts and deterministic concept-preview helpers
  index.ts        Worker routes, Durable Object, and Workflow classes
  state.ts        Pure state transition helpers
  types.ts        Shared types
test/
  app.test.tsx    UI interaction smoke tests for buttons and core flows
  state.test.ts   State transition verification
  ai.test.ts      Launch-artifact generation coverage
PROMPTS.md        AI prompts used during brainstorming and implementation
```

## AI-Assisted Development

AI-assisted coding was used for brainstorming, planning, and implementation support. The prompts used are documented in `PROMPTS.md`.

## Submission Notes

- Cloudflare's assignment asks for the repository name to start with `cf_ai_`. For submission, this repo should be published with a name such as `cf_ai_idea_to_launch_agent`.
- This repository includes a `README.md` with running instructions and architecture notes, and a `PROMPTS.md` file documenting AI assistance.
- The final application logic in this repo is original work built on top of a generic Cloudflare starter template.
