import {
	ChatMessage,
	ForecastPoint,
	LaunchArtifacts,
	PitchDeckSlide,
	ProjectState,
	SnapshotExtraction,
	WebsitePrototype,
	WorkflowStatus,
} from "./types";

export const STATE_KEY = "project-state";

export const INITIAL_ASSISTANT_MESSAGE =
	"Describe the AI product or workflow you want to test, and I'll turn it into a target user, believable MVP wedge, and launch plan.";

function nowIso(): string {
	return new Date().toISOString();
}

function normalizeText(value: string | null | undefined): string {
	return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeList(values: string[] | null | undefined): string[] {
	const seen = new Set<string>();
	const output: string[] = [];

	for (const value of values ?? []) {
		const normalized = normalizeText(value);
		if (!normalized) continue;
		const key = normalized.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		output.push(normalized);
	}

	return output;
}

function mergeString(previous: string, incoming: string): string {
	return incoming ? incoming : previous;
}

function mergeList(previous: string[], incoming: string[]): string[] {
	return normalizeList([...previous, ...incoming]);
}

function createWorkflowStatus(
	overrides?: Partial<WorkflowStatus>,
): WorkflowStatus {
	return {
		status: "idle",
		workflowId: null,
		sourceRevision: null,
		error: null,
		updatedAt: null,
		...overrides,
	};
}

export function createDefaultState(): ProjectState {
	return {
		revision: 0,
		messages: [{ role: "assistant", content: INITIAL_ASSISTANT_MESSAGE }],
		ideaName: "",
		oneLiner: "",
		targetUser: "",
		problem: "",
		solution: "",
		keyFeatures: [],
		mvpScope: [],
		risks: [],
		openQuestions: [],
		workflowStatus: createWorkflowStatus(),
		launchBrief: null,
		checklist: [],
		pitchDeck: [],
		forecast: [],
		websitePrototype: null,
	};
}

export function resetState(): ProjectState {
	return createDefaultState();
}

function normalizeDeckSlides(
	slides: PitchDeckSlide[] | null | undefined,
): PitchDeckSlide[] {
	return (slides ?? [])
		.map((slide) => ({
			title: normalizeText(slide.title),
			headline: normalizeText(slide.headline),
			bullets: normalizeList(slide.bullets),
		}))
		.filter(
			(slide) =>
				slide.title.length > 0 ||
				slide.headline.length > 0 ||
				slide.bullets.length > 0,
		);
}

function normalizeForecast(
	points: ForecastPoint[] | null | undefined,
): ForecastPoint[] {
	return (points ?? [])
		.map((point) => ({
			label: normalizeText(point.label),
			value: Number.isFinite(point.value)
				? Math.max(0, Math.round(point.value))
				: 0,
		}))
		.filter((point) => point.label.length > 0);
}

function normalizeWebsitePrototype(
	prototype: WebsitePrototype | null | undefined,
): WebsitePrototype | null {
	if (!prototype) {
		return null;
	}

	const title = normalizeText(prototype.title);
	const summary = normalizeText(prototype.summary);
	const html = (prototype.html ?? "").trim();

	if (!title && !summary && !html) {
		return null;
	}

	return {
		title,
		summary,
		html,
	};
}

function resetArtifacts(
	state: ProjectState,
): Pick<
	ProjectState,
	| "workflowStatus"
	| "launchBrief"
	| "checklist"
	| "pitchDeck"
	| "forecast"
	| "websitePrototype"
> {
	return {
		workflowStatus: createWorkflowStatus(),
		launchBrief: null,
		checklist: [],
		pitchDeck: [],
		forecast: [],
		websitePrototype: null,
	};
}

function withRevision(state: ProjectState): ProjectState {
	return { ...state, revision: state.revision + 1 };
}

export function appendUserMessage(
	state: ProjectState,
	message: string,
): ProjectState {
	const normalized = normalizeText(message);
	if (!normalized) {
		return state;
	}

	return withRevision({
		...state,
		messages: [...state.messages, { role: "user", content: normalized }],
		...resetArtifacts(state),
	});
}

export function appendAssistantMessage(
	state: ProjectState,
	message: string,
): ProjectState {
	const normalized = normalizeText(message);
	if (!normalized) {
		return state;
	}

	return withRevision({
		...state,
		messages: [...state.messages, { role: "assistant", content: normalized }],
	});
}

export function mergeSnapshot(
	state: ProjectState,
	snapshot: SnapshotExtraction,
): ProjectState {
	const normalizedSnapshot: SnapshotExtraction = {
		ideaName: normalizeText(snapshot.ideaName),
		oneLiner: normalizeText(snapshot.oneLiner),
		targetUser: normalizeText(snapshot.targetUser),
		problem: normalizeText(snapshot.problem),
		solution: normalizeText(snapshot.solution),
		keyFeatures: normalizeList(snapshot.keyFeatures),
		mvpScope: normalizeList(snapshot.mvpScope),
		risks: normalizeList(snapshot.risks),
		openQuestions: normalizeList(snapshot.openQuestions),
	};

	const nextState: ProjectState = {
		...state,
		ideaName: mergeString(state.ideaName, normalizedSnapshot.ideaName),
		oneLiner: mergeString(state.oneLiner, normalizedSnapshot.oneLiner),
		targetUser: mergeString(state.targetUser, normalizedSnapshot.targetUser),
		problem: mergeString(state.problem, normalizedSnapshot.problem),
		solution: mergeString(state.solution, normalizedSnapshot.solution),
		keyFeatures: mergeList(state.keyFeatures, normalizedSnapshot.keyFeatures),
		mvpScope: mergeList(state.mvpScope, normalizedSnapshot.mvpScope),
		risks: mergeList(state.risks, normalizedSnapshot.risks),
		openQuestions: mergeList(state.openQuestions, normalizedSnapshot.openQuestions),
	};

	if (JSON.stringify(nextState) === JSON.stringify(state)) {
		return state;
	}

	return withRevision(nextState);
}

export function markWorkflowRunning(
	state: ProjectState,
	workflowId: string,
): ProjectState {
	return {
		...state,
		workflowStatus: createWorkflowStatus({
			status: "running",
			workflowId,
			sourceRevision: state.revision,
			error: null,
			updatedAt: nowIso(),
		}),
		launchBrief: null,
		checklist: [],
		pitchDeck: [],
		forecast: [],
		websitePrototype: null,
	};
}

export function completeWorkflow(
	state: ProjectState,
	workflowId: string,
	sourceRevision: number,
	artifacts: LaunchArtifacts,
): ProjectState {
	if (
		state.workflowStatus.workflowId !== workflowId ||
		state.workflowStatus.sourceRevision !== sourceRevision
	) {
		return state;
	}

	return {
		...state,
		workflowStatus: createWorkflowStatus({
			status: "complete",
			workflowId,
			sourceRevision,
			error: null,
			updatedAt: nowIso(),
		}),
		launchBrief: artifacts.launchBrief,
		checklist: normalizeList(artifacts.checklist),
		pitchDeck: normalizeDeckSlides(artifacts.pitchDeck),
		forecast: normalizeForecast(artifacts.forecast),
		websitePrototype: normalizeWebsitePrototype(artifacts.websitePrototype),
	};
}

function collectUserSignals(messages: ChatMessage[]): string[] {
	return messages
		.filter((message) => message.role === "user")
		.map((message) => normalizeText(message.content))
		.filter(Boolean);
}

function formatIdeaWord(word: string): string {
	if (!word) {
		return "";
	}

	if (/^[A-Z0-9-]{2,5}$/.test(word)) {
		return word;
	}

	return word
		.split("-")
		.map((part) =>
			part.length <= 3 && /^[a-z]+$/i.test(part) && part === part.toUpperCase()
				? part
				: part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
		)
		.join("-");
}

function normalizeIdeaPhrase(source: string): string {
	return source
		.replace(/[“”"'`]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function toIdeaName(source: string): string {
	let cleaned = normalizeIdeaPhrase(source)
		.replace(
			/^(help me (?:design|build|create)|build|create|design|make|launch|turn)\s+/i,
			"",
		)
		.replace(/^(an?|the)\s+/i, "")
		.replace(/[^\w\s-]/g, " ");

	cleaned = cleaned.split(/\b(?:that|which|who)\b/i)[0] ?? cleaned;

	const forSplit = cleaned.split(/\bfor\b/i);
	if (forSplit.length > 1) {
		const leading = normalizeIdeaPhrase(forSplit[0] ?? "");
		const trailing = normalizeIdeaPhrase(forSplit.slice(1).join(" "));
		const leadingWords = leading.split(/\s+/).filter(Boolean);
		const trailingWords = trailing.split(/\s+/).filter(Boolean);

		if (
			leadingWords.length >= 2 &&
			trailingWords.length >= 2 &&
			!["teams", "businesses", "developers", "founders"].includes(
				trailingWords[trailingWords.length - 1]?.toLowerCase() ?? "",
			)
		) {
			cleaned = leading;
		}
	}

	const cleanedWords = cleaned
		.split(/\s+/)
		.filter(Boolean)
		.filter(
			(word) =>
				![
					"with",
					"into",
					"from",
					"helps",
					"turns",
					"tool",
					"app",
					"platform",
				].includes(word.toLowerCase()),
		)
		.slice(0, 5);

	if (cleanedWords.length === 0) {
		return "New Product Idea";
	}

	const cleanedTitle = cleanedWords
		.map((word) => formatIdeaWord(word))
		.join(" ")
		.replace(/\bAi\b/g, "AI")
		.replace(/\bSaas\b/g, "SaaS");

	return cleanedTitle || "New Product Idea";
}

function firstSentence(source: string): string {
	const sentence = source.split(/(?<=[.!?])\s+/)[0] ?? source;
	return normalizeText(sentence);
}

function takePhrases(source: string): string[] {
	return normalizeList(
		source
			.split(/[.;,\n]|(?:\band\b)|(?:\bwith\b)/i)
			.map((part) => normalizeText(part))
			.filter((part) => part.length > 8),
	).slice(0, 4);
}

export function deriveSnapshotFromConversation(
	state: ProjectState,
): SnapshotExtraction {
	const userSignals = collectUserSignals(state.messages);
	const latestUserSignal =
		userSignals.length > 0 ? userSignals[userSignals.length - 1] : "";
	const combinedSignals = userSignals.join(". ");
	const earliestSignal = userSignals[0] ?? "";

	const fallbackFeatures = takePhrases(combinedSignals);
	const fallbackRisks = [
		"Need to validate real demand with early users.",
		"Scope can grow too quickly without a tight MVP.",
	].slice(0, combinedSignals ? 2 : 0);
	const fallbackQuestions = [
		"What is the smallest lovable workflow to ship first?",
		"Which user segment should be the first design partner?",
	].slice(0, combinedSignals ? 2 : 0);

	return {
		ideaName:
			state.ideaName ||
			toIdeaName(firstSentence(earliestSignal || latestUserSignal || "Product Idea")),
		oneLiner: state.oneLiner || firstSentence(earliestSignal || latestUserSignal),
		targetUser:
			state.targetUser ||
			(combinedSignals
				? "Early adopters described in the conversation; refine during brainstorming."
				: ""),
		problem:
			state.problem ||
			(latestUserSignal
				? firstSentence(latestUserSignal)
				: ""),
		solution:
			state.solution ||
			(combinedSignals
				? "An AI-powered product experience shaped through brainstorming, fast prototyping, and iteration."
				: ""),
		keyFeatures: state.keyFeatures.length > 0 ? state.keyFeatures : fallbackFeatures,
		mvpScope:
			state.mvpScope.length > 0
				? state.mvpScope
				: fallbackFeatures.slice(0, 3),
		risks: state.risks.length > 0 ? state.risks : fallbackRisks,
		openQuestions:
			state.openQuestions.length > 0 ? state.openQuestions : fallbackQuestions,
	};
}

export function failWorkflow(
	state: ProjectState,
	workflowId: string,
	sourceRevision: number,
	message: string,
): ProjectState {
	if (
		state.workflowStatus.workflowId !== workflowId ||
		state.workflowStatus.sourceRevision !== sourceRevision
	) {
		return state;
	}

	return {
		...state,
		workflowStatus: createWorkflowStatus({
			status: "errored",
			workflowId,
			sourceRevision,
			error: normalizeText(message) || "The launch brief workflow failed.",
			updatedAt: nowIso(),
		}),
	};
}

export function isNonEmptyMessage(message: ChatMessage): boolean {
	return normalizeText(message.content).length > 0;
}

export function trimConversation(messages: ChatMessage[], limit = 14): ChatMessage[] {
	const nonEmptyMessages = messages.filter(isNonEmptyMessage);
	if (nonEmptyMessages.length <= limit) {
		return nonEmptyMessages;
	}

	return nonEmptyMessages.slice(-limit);
}
