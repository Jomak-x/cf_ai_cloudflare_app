// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HashRouter } from "react-router-dom";
import App from "../app/src/App";
import type { ProjectState } from "../app/src/lib/types";

function createState(overrides: Partial<ProjectState> = {}): ProjectState {
	return {
		revision: 0,
		messages: [
			{
				role: "assistant",
				content:
					"Describe the AI product or workflow you want to test, and I'll turn it into a target user, believable MVP wedge, and launch plan.",
			},
		],
		ideaName: "",
		oneLiner: "",
		targetUser: "",
		problem: "",
		solution: "",
		keyFeatures: [],
		mvpScope: [],
		risks: [],
		openQuestions: [],
		workflowStatus: {
			status: "idle",
			workflowId: null,
			sourceRevision: null,
			error: null,
			updatedAt: null,
		},
		launchBrief: null,
		checklist: [],
		pitchDeck: [],
		forecast: [],
		websitePrototype: null,
		...overrides,
	};
}

function createSseResponse(payloads: Array<string | object>) {
	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		start(controller) {
			for (const payload of payloads) {
				const body =
					typeof payload === "string" ? payload : JSON.stringify(payload);
				controller.enqueue(encoder.encode(`data: ${body}\n\n`));
			}
			controller.enqueue(encoder.encode("data: [DONE]\n\n"));
			controller.close();
		},
	});

	return new Response(stream, {
		headers: {
			"content-type": "text/event-stream; charset=utf-8",
		},
	});
}

describe("LaunchLens app", () => {
	beforeEach(() => {
		window.localStorage.clear();
		window.location.hash = "#/";
		vi.stubGlobal("scrollTo", vi.fn());
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("opens the workspace from the landing page", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/api/state")) {
				return new Response(JSON.stringify(createState()), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}
			throw new Error(`Unexpected request: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		render(
			<HashRouter>
				<App />
			</HashRouter>,
		);

		await userEvent.click(await screen.findByRole("button", { name: "Open Workspace" }));

		expect(
			await screen.findByRole("heading", {
				name: "Pressure-test the idea, then generate the launch pack.",
			}),
		).toBeTruthy();
	});

	it("sends a message through the chat button and renders the streamed reply", async () => {
		const initialState = createState();
		const finalState = createState({
			revision: 2,
			messages: [
				...initialState.messages,
				{
					role: "user",
					content:
						"Build an AI concierge for boutique hotels that helps front desk teams answer guest questions faster.",
				},
				{
					role: "assistant",
					content:
						"**Target user** Boutique hotel front desk teams\n\n**Next move** Validate the concierge workflow with one pilot property.",
				},
			],
			ideaName: "AI Concierge",
			oneLiner:
				"Build an AI concierge for boutique hotels that helps front desk teams answer guest questions faster.",
		});

		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.includes("/api/state")) {
				return new Response(JSON.stringify(initialState), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}
			if (url === "/api/chat" && init?.method === "POST") {
				return createSseResponse([
					{ response: "**Target user** Boutique hotel front desk teams" },
					{ state: finalState },
				]);
			}
			throw new Error(`Unexpected request: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		render(
			<HashRouter>
				<App />
			</HashRouter>,
		);

		await userEvent.click(await screen.findByRole("button", { name: "Open Workspace" }));
		await userEvent.type(
			await screen.findByPlaceholderText(
				"Describe the AI product, workflow, or niche service copilot you want to validate...",
			),
			"Build an AI concierge for boutique hotels that helps front desk teams answer guest questions faster.",
		);
		await userEvent.click(screen.getByRole("button", { name: "Send" }));

		expect(
			await screen.findByText("Validate the concierge workflow with one pilot property."),
		).toBeTruthy();
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/chat",
			expect.objectContaining({
				method: "POST",
			}),
		);
	});

	it("loads a starter prompt from the landing page and opens the workspace", async () => {
		const initialState = createState();
		const finalState = createState({
			revision: 2,
			messages: [
				...initialState.messages,
				{
					role: "user",
					content:
						"Build an AI concierge for boutique hotels that helps front desk teams answer guest questions faster and upsell the right services.",
				},
				{
					role: "assistant",
					content:
						"**Target user** Boutique hotel front desk teams\n\n**Next move** Pilot the concierge with one property and measure response time.",
				},
			],
			ideaName: "AI Concierge",
			oneLiner:
				"Build an AI concierge for boutique hotels that helps front desk teams answer guest questions faster and upsell the right services.",
		});

		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.includes("/api/state")) {
				return new Response(JSON.stringify(initialState), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}
			if (url === "/api/chat" && init?.method === "POST") {
				return createSseResponse([
					{ response: "**Target user** Boutique hotel front desk teams" },
					{ state: finalState },
				]);
			}
			throw new Error(`Unexpected request: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		render(
			<HashRouter>
				<App />
			</HashRouter>,
		);

		await userEvent.click(await screen.findByRole("button", { name: "Load Sample Prompt" }));

		expect(
			await screen.findByRole("heading", {
				name: "Pressure-test the idea, then generate the launch pack.",
			}),
		).toBeTruthy();
		expect(
			await screen.findByText("Pilot the concierge with one property and measure response time."),
		).toBeTruthy();
	});

	it("returns to the landing page from the workspace back button", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/api/state")) {
				return new Response(JSON.stringify(createState()), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}
			throw new Error(`Unexpected request: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		render(
			<HashRouter>
				<App />
			</HashRouter>,
		);

		await userEvent.click(await screen.findByRole("button", { name: "Open Workspace" }));
		await userEvent.click(screen.getByRole("button", { name: "Back To Landing" }));

		expect(
			await screen.findByRole("heading", {
				name: "Find the wedge. Shape the pitch. Build the launch pack.",
			}),
		).toBeTruthy();
	});

	it("builds the launch pack and resets to a fresh session", async () => {
		const stateWithUserMessage = createState({
			revision: 2,
			messages: [
				{
					role: "assistant",
					content:
						"Describe the AI product or workflow you want to test, and I'll turn it into a target user, believable MVP wedge, and launch plan.",
				},
				{
					role: "user",
					content:
						"Design a receipt-based budgeting coach for busy families that turns grocery purchases into weekly savings recommendations.",
				},
			],
			ideaName: "Receipt-Based Budgeting Coach",
			oneLiner:
				"Design a receipt-based budgeting coach for busy families that turns grocery purchases into weekly savings recommendations.",
		});

		const launchPackState = createState({
			...stateWithUserMessage,
			workflowStatus: {
				status: "complete",
				workflowId: "wf-1",
				sourceRevision: 2,
				error: null,
				updatedAt: new Date().toISOString(),
			},
			launchBrief: {
				summary:
					"Receipt-Based Budgeting Coach helps busy families turn grocery spending into weekly savings decisions.",
				audience: "Busy families with recurring grocery spend",
				valueProposition: "Weekly savings recommendations from real purchase history.",
				launchStrategy: "Pilot with five families and measure repeat weekly check-ins.",
				successMetric: "Weekly active families completing one savings action.",
			},
			checklist: ["Ship receipt upload", "Recruit five pilot households"],
			forecast: [
				{ label: "Week 1", value: 8 },
				{ label: "Week 2", value: 18 },
			],
			websitePrototype: {
				title: "Receipt-Based Budgeting Coach",
				summary: "A focused concept preview for budget-conscious families.",
				html: "<!doctype html><html><body><h1>Receipt-Based Budgeting Coach</h1></body></html>",
			},
		});

		const freshState = createState();
		const stateResponses = [stateWithUserMessage, launchPackState, freshState];

		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.includes("/api/state")) {
				const nextState = stateResponses.shift() ?? freshState;
				return new Response(JSON.stringify(nextState), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}
			if (url === "/api/generate-brief" && init?.method === "POST") {
				return new Response(JSON.stringify({ status: "running" }), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}
			if (url === "/api/reset" && init?.method === "POST") {
				return new Response(JSON.stringify(freshState), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}
			throw new Error(`Unexpected request: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		render(
			<HashRouter>
				<App />
			</HashRouter>,
		);

		await userEvent.click(await screen.findByRole("button", { name: "Open Workspace" }));
		await userEvent.click(
			await screen.findByRole("button", { name: "Build Launch Pack" }),
		);

		expect(
			await screen.findByRole("heading", { name: "Receipt-Based Budgeting Coach" }),
		).toBeTruthy();

		const previousSessionId = window.localStorage.getItem("idea-to-launch-session-id");
		await userEvent.click(screen.getByRole("button", { name: "New Session" }));

		expect(
			await screen.findByRole("heading", {
				name: "Find the wedge. Shape the pitch. Build the launch pack.",
			}),
		).toBeTruthy();
		await waitFor(() => {
			expect(window.localStorage.getItem("idea-to-launch-session-id")).not.toBe(
				previousSessionId,
			);
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/reset",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ sessionId: previousSessionId }),
			}),
		);
	});
});
