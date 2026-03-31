import { afterEach, describe, expect, it, vi } from "vitest";
import { generateLaunchArtifacts } from "../src/ai";
import { createDefaultState, appendUserMessage, mergeSnapshot } from "../src/state";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("AI artifact generation fallbacks", () => {
	it("returns a complete deterministic artifact set when Workers AI fails", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});

		const baseState = appendUserMessage(
			createDefaultState(),
			"Build an AI concierge for boutique hotels that answers guest questions faster.",
		);
		const state = mergeSnapshot(baseState, {
			ideaName: "HotelFlow",
			oneLiner: "An AI concierge for boutique hotel teams",
			targetUser: "Boutique hotel staff",
			problem: "Guest questions interrupt staff and create inconsistent responses.",
			solution: "A guided concierge workspace that drafts fast, on-brand answers.",
			keyFeatures: ["Shared inbox", "Suggested answers", "Knowledge snippets"],
			mvpScope: ["Inbox", "Suggested reply", "Admin setup"],
			risks: ["Need strong response quality"],
			openQuestions: ["Should the first wedge be front desk teams or guest messaging teams?"],
		});

		const env = {
			AI: {
				run: async () => {
					throw new Error("Upstream timeout");
				},
			},
		} as unknown as Pick<Cloudflare.Env, "AI">;

		const artifacts = await generateLaunchArtifacts(env, state);

		expect(artifacts.launchBrief.summary).toContain("HotelFlow");
		expect(artifacts.checklist.length).toBeGreaterThan(0);
		expect(artifacts.pitchDeck.length).toBeGreaterThan(0);
		expect(artifacts.forecast.length).toBe(5);
		expect(artifacts.websitePrototype.title).toContain("HotelFlow");
		expect(artifacts.websitePrototype.html).toContain("<!doctype html>");
	});
});
