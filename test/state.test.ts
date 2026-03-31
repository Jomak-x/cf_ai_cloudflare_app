import { describe, expect, it } from "vitest";
import {
	appendAssistantMessage,
	appendUserMessage,
	completeWorkflow,
	createDefaultState,
	deriveSnapshotFromConversation,
	failWorkflow,
	markWorkflowRunning,
	mergeSnapshot,
	resetState,
} from "../src/state";

describe("project state", () => {
	it("starts with a welcome message and idle workflow state", () => {
		const state = createDefaultState();

		expect(state.messages).toHaveLength(1);
		expect(state.messages[0]?.role).toBe("assistant");
		expect(state.workflowStatus.status).toBe("idle");
		expect(state.launchBrief).toBeNull();
		expect(state.pitchDeck).toEqual([]);
		expect(state.forecast).toEqual([]);
		expect(state.websitePrototype).toBeNull();
	});

	it("stores user and assistant turns and increments revision", () => {
		const userState = appendUserMessage(createDefaultState(), "Launch an AI planner");
		const finalState = appendAssistantMessage(
			userState,
			"Let's define the audience and MVP.",
		);

		expect(userState.revision).toBe(1);
		expect(finalState.revision).toBe(2);
		expect(finalState.messages.at(-1)?.role).toBe("assistant");
	});

	it("merges structured snapshot fields without erasing useful values", () => {
		const withIdea = mergeSnapshot(createDefaultState(), {
			ideaName: "Receipt Coach",
			oneLiner: "Budget coaching from grocery receipts",
			targetUser: "Busy parents",
			problem: "Budgeting feels tedious",
			solution: "Turn receipts into weekly coaching",
			keyFeatures: ["Receipt upload", "Weekly nudges"],
			mvpScope: ["Receipt parsing", "Weekly summary"],
			risks: ["OCR accuracy"],
			openQuestions: ["How much automation is enough?"],
		});

		const merged = mergeSnapshot(withIdea, {
			ideaName: "",
			oneLiner: "",
			targetUser: "",
			problem: "",
			solution: "",
			keyFeatures: ["Weekly nudges", "Family spending categories"],
			mvpScope: ["Weekly summary"],
			risks: ["Data privacy"],
			openQuestions: [],
		});

		expect(merged.ideaName).toBe("Receipt Coach");
		expect(merged.keyFeatures).toEqual([
			"Receipt upload",
			"Weekly nudges",
			"Family spending categories",
		]);
		expect(merged.risks).toEqual(["OCR accuracy", "Data privacy"]);
	});

	it("marks a workflow as running and ignores stale completion payloads", () => {
		const initial = appendUserMessage(createDefaultState(), "Help me launch a study app");
		const running = markWorkflowRunning(initial, "wf-1");
		const staleCompletion = completeWorkflow(running, "wf-1", 999, {
			launchBrief: {
				summary: "Stale brief",
				audience: "Students",
				valueProposition: "Faster studying",
				launchStrategy: "Campus ambassadors",
				successMetric: "10 active teams",
			},
			checklist: ["Do not apply"],
			pitchDeck: [],
			forecast: [],
			websitePrototype: {
				title: "",
				summary: "",
				html: "",
			},
		});

		expect(staleCompletion.launchBrief).toBeNull();
		expect(staleCompletion.workflowStatus.status).toBe("running");

		const completed = completeWorkflow(
			running,
			"wf-1",
			running.workflowStatus.sourceRevision ?? -1,
			{
				launchBrief: {
					summary: "Interactive study guides for long videos.",
					audience: "College students learning from YouTube",
					valueProposition: "Turn passive video watching into guided practice.",
					launchStrategy: "Seed creator partnerships and campus study groups.",
					successMetric: "Weekly active study sessions per learner.",
				},
				checklist: ["Ship the first importer", "Recruit five test users"],
				pitchDeck: [
					{
						title: "Problem",
						headline: "Students lose context in long videos",
						bullets: ["Passive learning", "No structured checkpoints"],
					},
				],
				forecast: [
					{ label: "Week 1", value: 20 },
					{ label: "Week 2", value: 45 },
				],
				websitePrototype: {
					title: "StudySprint",
					summary: "A lightweight website prototype for interactive study guides.",
					html: "<!doctype html><html><body><h1>StudySprint</h1></body></html>",
				},
			},
		);

		expect(completed.workflowStatus.status).toBe("complete");
		expect(completed.launchBrief?.audience).toContain("College students");
		expect(completed.checklist).toHaveLength(2);
		expect(completed.pitchDeck).toHaveLength(1);
		expect(completed.forecast).toHaveLength(2);
		expect(completed.websitePrototype?.title).toBe("StudySprint");
	});

	it("resets launch artifacts when the user changes the idea after a completed run", () => {
		const running = markWorkflowRunning(
			appendUserMessage(createDefaultState(), "Build a hotel concierge"),
			"wf-2",
		);
		const completed = completeWorkflow(
			running,
			"wf-2",
			running.workflowStatus.sourceRevision ?? -1,
			{
				launchBrief: {
					summary: "A staff-side guest concierge.",
					audience: "Boutique hotel teams",
					valueProposition: "Faster, more consistent guest replies.",
					launchStrategy: "Pilot with one property group.",
					successMetric: "Response time and guest satisfaction.",
				},
				checklist: ["Pilot workflow"],
				pitchDeck: [
					{
						title: "Why now",
						headline: "Hotels need faster guest response loops",
						bullets: ["Staff bandwidth is limited"],
					},
				],
				forecast: [{ label: "Week 1", value: 10 }],
				websitePrototype: {
					title: "HotelFlow",
					summary: "A boutique hotel concierge prototype.",
					html: "<!doctype html><html><body><h1>HotelFlow</h1></body></html>",
				},
			},
		);
		const edited = appendUserMessage(
			completed,
			"Actually, focus on spa upsells instead of general concierge.",
		);

		expect(edited.launchBrief).toBeNull();
		expect(edited.checklist).toEqual([]);
		expect(edited.pitchDeck).toEqual([]);
		expect(edited.forecast).toEqual([]);
		expect(edited.websitePrototype).toBeNull();
		expect(edited.workflowStatus.status).toBe("idle");
	});

	it("derives a cleaner idea name from long natural-language prompts", () => {
		const state = appendUserMessage(
			createDefaultState(),
			"Design a receipt-based budgeting coach for busy families that turns grocery purchases into weekly savings recommendations.",
		);

		const snapshot = deriveSnapshotFromConversation(state);

		expect(snapshot.ideaName).toBe("Receipt-Based Budgeting Coach");
		expect(snapshot.oneLiner).toContain("receipt-based budgeting coach");
	});

	it("preserves useful acronyms in derived idea names", () => {
		const state = appendUserMessage(
			createDefaultState(),
			"Build an AI concierge for boutique hotels that helps front desk teams answer guest questions faster.",
		);

		const snapshot = deriveSnapshotFromConversation(state);

		expect(snapshot.ideaName).toBe("AI Concierge");
	});

	it("records matching workflow failures and supports reset", () => {
		const running = markWorkflowRunning(
			appendUserMessage(createDefaultState(), "AI grocery coach"),
			"wf-3",
		);
		const failed = failWorkflow(
			running,
			"wf-3",
			running.workflowStatus.sourceRevision ?? -1,
			"Generation timed out",
		);

		expect(failed.workflowStatus.status).toBe("errored");
		expect(failed.workflowStatus.error).toContain("timed out");
		expect(resetState()).toEqual(createDefaultState());
	});
});
