export interface ChatMessage {
	role: "user" | "assistant";
	content: string;
}

export interface LaunchBrief {
	summary: string;
	audience: string;
	valueProposition: string;
	launchStrategy: string;
	successMetric: string;
}

export interface PitchDeckSlide {
	title: string;
	headline: string;
	bullets: string[];
}

export interface ForecastPoint {
	label: string;
	value: number;
}

export interface WebsitePrototype {
	title: string;
	summary: string;
	html: string;
}

export interface WorkflowStatus {
	status: "idle" | "running" | "complete" | "errored";
	workflowId: string | null;
	sourceRevision: number | null;
	error: string | null;
	updatedAt: string | null;
}

export interface ProjectState {
	revision: number;
	messages: ChatMessage[];
	ideaName: string;
	oneLiner: string;
	targetUser: string;
	problem: string;
	solution: string;
	keyFeatures: string[];
	mvpScope: string[];
	risks: string[];
	openQuestions: string[];
	workflowStatus: WorkflowStatus;
	launchBrief: LaunchBrief | null;
	checklist: string[];
	pitchDeck: PitchDeckSlide[];
	forecast: ForecastPoint[];
	websitePrototype: WebsitePrototype | null;
}

export interface ApiErrorResponse {
	error?: string;
}

export interface SpeechRecognitionResultLike {
	readonly transcript: string;
}

export interface SpeechRecognitionResultListLike {
	[index: number]: {
		[index: number]: SpeechRecognitionResultLike;
	};
}

export interface SpeechRecognitionEventLike extends Event {
	results: SpeechRecognitionResultListLike;
}

export interface SpeechRecognitionLike {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	maxAlternatives: number;
	onstart: (() => void) | null;
	onresult: ((event: SpeechRecognitionEventLike) => void) | null;
	onerror: ((event: { error: string }) => void) | null;
	onend: (() => void) | null;
	start(): void;
	stop(): void;
}

export interface SpeechRecognitionConstructor {
	new (): SpeechRecognitionLike;
}

declare global {
	interface Window {
		SpeechRecognition?: SpeechRecognitionConstructor;
		webkitSpeechRecognition?: SpeechRecognitionConstructor;
	}
}
