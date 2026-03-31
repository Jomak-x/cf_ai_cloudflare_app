import { startTransition, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ArrowRight, BrainCircuit, Mic, Sparkles, Wand2 } from "lucide-react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { MarkdownContent } from "./components/MarkdownContent";
import { ForecastChart } from "./components/ForecastChart";
import type {
	ApiErrorResponse,
	ChatMessage,
	ProjectState,
	SpeechRecognitionLike,
} from "./lib/types";

const SESSION_STORAGE_KEY = "idea-to-launch-session-id";
const POLL_INTERVAL_MS = 2200;
const FALLBACK_REFRESH_DELAY_MS = 600;

const STARTER_PROMPTS = [
	"Build an AI concierge for boutique hotels that helps front desk teams answer guest questions faster and upsell the right services.",
	"Create a study copilot that turns long lecture videos into checkpoints, quizzes, and revision plans for university students.",
	"Design a receipt-based budgeting coach for busy families that turns grocery purchases into weekly savings recommendations.",
];

const SPEECH_RECOGNITION =
	typeof window !== "undefined"
		? window.SpeechRecognition || window.webkitSpeechRecognition || null
		: null;

type AppState = ProjectState | null;

export default function App() {
	const navigate = useNavigate();
	const location = useLocation();
	const chatScrollRef = useRef<HTMLDivElement | null>(null);
	const userInputRef = useRef<HTMLTextAreaElement | null>(null);
	const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
	const pollHandleRef = useRef<number | null>(null);
	const queuedStarterPromptRef = useRef<string | null>(null);
	const messageRenderFrameRef = useRef<number | null>(null);
	const pendingAssistantMessageRef = useRef("");

	const [sessionId, setSessionId] = useState(() => getOrCreateSessionId());
	const activeSessionIdRef = useRef(sessionId);
	const [currentState, setCurrentState] = useState<AppState>(null);
	const [pendingAssistantMessage, setPendingAssistantMessage] = useState<string | null>(null);
	const [draft, setDraft] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [isListening, setIsListening] = useState(false);
	const [voiceStatus, setVoiceStatus] = useState("Voice input ready.");

	useEffect(() => {
		activeSessionIdRef.current = sessionId;
	}, [sessionId]);

	useEffect(() => {
		void loadState();

		return () => {
			if (pollHandleRef.current !== null) {
				window.clearInterval(pollHandleRef.current);
			}
			if (messageRenderFrameRef.current !== null) {
				window.cancelAnimationFrame(messageRenderFrameRef.current);
			}
		};
	}, [sessionId]);

	useEffect(() => {
		if (!SPEECH_RECOGNITION) {
			setVoiceStatus("Voice input is available in supported Chromium-based browsers.");
			return;
		}

		const recognition = new SPEECH_RECOGNITION();
		recognition.lang = "en-US";
		recognition.continuous = false;
		recognition.interimResults = false;
		recognition.maxAlternatives = 1;
		recognition.onstart = () => {
			setIsListening(true);
			setVoiceStatus("Listening... pause when you're done speaking.");
		};
		recognition.onresult = (event) => {
			const transcript = event.results?.[0]?.[0]?.transcript ?? "";
			if (!transcript.trim()) {
				return;
			}
			startTransition(() => {
				setDraft(transcript.replace(/\s+/g, " ").trim());
				setVoiceStatus("Voice captured. Edit if needed, then send.");
			});
			navigate("/workspace");
		};
		recognition.onerror = (event) => {
			setVoiceStatus(
				event.error === "not-allowed"
					? "Microphone permission was denied."
					: "Voice input hit an issue. Please try again or type instead.",
			);
		};
		recognition.onend = () => {
			setIsListening(false);
		};

		recognitionRef.current = recognition;

		return () => {
			recognition.stop();
			recognitionRef.current = null;
		};
	}, [navigate]);

	useEffect(() => {
		const isWorkspace = location.pathname === "/workspace";
		if (!isWorkspace || !queuedStarterPromptRef.current || isSending) {
			return;
		}

		const prompt = queuedStarterPromptRef.current;
		queuedStarterPromptRef.current = null;
		void sendMessage(prompt);
	}, [isSending, location.pathname]);

	useEffect(() => {
		const workflowRunning = currentState?.workflowStatus.status === "running";

		if (workflowRunning && pollHandleRef.current === null) {
			pollHandleRef.current = window.setInterval(() => {
				void loadState();
			}, POLL_INTERVAL_MS);
			return;
		}

		if (!workflowRunning && pollHandleRef.current !== null) {
			window.clearInterval(pollHandleRef.current);
			pollHandleRef.current = null;
		}
	}, [currentState?.workflowStatus.status]);

	useEffect(() => {
		const container = chatScrollRef.current;
		if (!container) {
			return;
		}

		if (pendingAssistantMessage !== null || isNearBottom(container, 140)) {
			container.scrollTop = container.scrollHeight;
		}
	}, [currentState?.messages, pendingAssistantMessage]);

	async function fetchState(targetSessionId = sessionId): Promise<ProjectState> {
		const response = await fetch(
			`/api/state?sessionId=${encodeURIComponent(targetSessionId)}`,
		);

		if (!response.ok) {
			throw new Error("Failed to load state");
		}

		return response.json() as Promise<ProjectState>;
	}

	async function loadState(targetSessionId = sessionId) {
		try {
			const nextState = await fetchState(targetSessionId);
			if (activeSessionIdRef.current !== targetSessionId) {
				return null;
			}
			startTransition(() => {
				setCurrentState(nextState);
			});
			return nextState;
		} catch (error) {
			console.error(error);
			return null;
		}
	}

	async function sendMessage(explicitMessage?: string) {
		const nextMessage = (explicitMessage ?? draft).trim();
		if (!nextMessage || isSending) {
			return;
		}
		const requestSessionId = sessionId;

		navigate("/workspace");

		if (isListening) {
			recognitionRef.current?.stop();
		}

		setIsSending(true);
		pendingAssistantMessageRef.current = "";
		setPendingAssistantMessage("");
		setDraft("");
		autoResizeTextarea(userInputRef.current, "");
		let receivedFinalState = false;

		startTransition(() => {
			setCurrentState((previousState) => {
				const messages = [...(previousState?.messages ?? []), { role: "user", content: nextMessage } satisfies ChatMessage];
				return {
					...(previousState ?? createClientFallbackState()),
					messages,
				};
			});
		});

		try {
			const response = await fetch("/api/chat", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ sessionId: requestSessionId, message: nextMessage }),
			});

			if (!response.ok || !response.body) {
				throw new Error("Failed to start chat response");
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";
			let sawDone = false;

			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					const parsed = consumeSseEvents(`${buffer}\n\n`);
				const result = applySseEvents(parsed.events, requestSessionId);
				receivedFinalState = receivedFinalState || result.receivedState;
				break;
			}

				buffer += decoder.decode(value, { stream: true });
				const parsed = consumeSseEvents(buffer);
				buffer = parsed.buffer;
				const result = applySseEvents(parsed.events, requestSessionId);
				sawDone = result.sawDone || sawDone;
				receivedFinalState = receivedFinalState || result.receivedState;
				if (sawDone) {
					break;
				}
			}
		} catch (error) {
			console.error(error);
			pendingAssistantMessageRef.current =
				"Something went wrong while generating the response. Please try again.";
			if (activeSessionIdRef.current === requestSessionId) {
				setPendingAssistantMessage(
					"Something went wrong while generating the response. Please try again.",
				);
			}
		} finally {
			const finalAssistantMessage = pendingAssistantMessageRef.current.trim();
			setIsSending(false);

			if (
				activeSessionIdRef.current === requestSessionId &&
				!receivedFinalState &&
				finalAssistantMessage
			) {
				startTransition(() => {
					setCurrentState((previousState) => appendLocalAssistant(previousState, finalAssistantMessage));
				});
				window.setTimeout(() => {
					if (activeSessionIdRef.current === requestSessionId) {
						void loadState(requestSessionId);
					}
				}, FALLBACK_REFRESH_DELAY_MS);
			}

			pendingAssistantMessageRef.current = "";
			if (activeSessionIdRef.current === requestSessionId) {
				setPendingAssistantMessage(null);
			}
			window.setTimeout(() => {
				userInputRef.current?.focus();
			}, 20);
		}
	}

	function applySseEvents(events: string[], requestSessionId: string) {
		let sawDone = false;
		let receivedState = false;

		for (const data of events) {
			if (data === "[DONE]") {
				sawDone = true;
				break;
			}

			try {
				const parsed = JSON.parse(data) as {
					response?: string;
					state?: ProjectState;
				};

				if (
					typeof parsed.response === "string" &&
					activeSessionIdRef.current === requestSessionId
				) {
					queuePendingAssistantChunk(parsed.response);
				}

				if (parsed.state) {
					const nextState = parsed.state;
					receivedState = true;
					pendingAssistantMessageRef.current = "";
					if (activeSessionIdRef.current === requestSessionId) {
						startTransition(() => {
							setCurrentState(nextState);
							setPendingAssistantMessage(null);
						});
					}
				}
			} catch (error) {
				console.error("Failed to parse SSE event", error, data);
			}
		}

		return { sawDone, receivedState };
	}

	function queuePendingAssistantChunk(chunk: string) {
		pendingAssistantMessageRef.current += chunk;
		if (messageRenderFrameRef.current !== null) {
			return;
		}

		messageRenderFrameRef.current = window.requestAnimationFrame(() => {
			startTransition(() => {
				setPendingAssistantMessage(pendingAssistantMessageRef.current);
			});
			messageRenderFrameRef.current = null;
		});
	}

	async function generateLaunchPack() {
		const requestSessionId = sessionId;
		try {
			startTransition(() => {
				setCurrentState((previousState) =>
					previousState
						? {
								...previousState,
								workflowStatus: {
									...previousState.workflowStatus,
									status: "running",
								},
							}
						: previousState,
				);
			});

			const response = await fetch("/api/generate-brief", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ sessionId: requestSessionId }),
			});

			if (!response.ok) {
				const payload = (await safeJson(response)) as ApiErrorResponse | null;
				throw new Error(payload?.error || "Failed to start launch-pack generation");
			}

			await loadState(requestSessionId);
		} catch (error) {
			console.error(error);
			startTransition(() => {
				setCurrentState((previousState) =>
					previousState
						? {
								...previousState,
								workflowStatus: {
									...previousState.workflowStatus,
									status: "errored",
									error:
										error instanceof Error
											? error.message
											: "Could not start launch-pack generation.",
								},
							}
						: previousState,
				);
			});
		}
	}

	async function resetSession() {
		try {
			const previousSessionId = sessionId;
			const response = await fetch("/api/reset", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ sessionId: previousSessionId }),
			});

			if (!response.ok) {
				throw new Error("Failed to reset state");
			}

			if (pollHandleRef.current !== null) {
				window.clearInterval(pollHandleRef.current);
				pollHandleRef.current = null;
			}

			recognitionRef.current?.stop();
			queuedStarterPromptRef.current = null;
			pendingAssistantMessageRef.current = "";
			setDraft("");
			setPendingAssistantMessage(null);
			startTransition(() => {
				setCurrentState(null);
			});
			setVoiceStatus(
				SPEECH_RECOGNITION
					? "Voice input ready."
					: "Voice input is available in supported Chromium-based browsers.",
			);
			setSessionId(createAndStoreSessionId());
			navigate("/");
		} catch (error) {
			console.error(error);
		}
	}

	function queueStarterPrompt(prompt: string) {
		queuedStarterPromptRef.current = prompt;
		navigate("/workspace");
	}

	function openWorkspace() {
		navigate("/workspace");
	}

	function toggleVoiceInput() {
		if (!recognitionRef.current || isSending) {
			return;
		}

		if (isListening) {
			recognitionRef.current.stop();
			return;
		}

		navigate("/workspace");
		setVoiceStatus("");
		recognitionRef.current.start();
	}

	const hasSessionContent = Boolean(
		currentState?.messages.some((message) => message.role === "user") ||
			currentState?.websitePrototype?.html,
	);
	const hasUserMessage = Boolean(
		currentState?.messages.some((message) => message.role === "user"),
	);

	return (
		<div className="mx-auto max-w-[1440px] p-4 sm:p-6">
			<Routes>
				<Route
					path="/"
					element={
						<LandingPage
							hasSessionContent={hasSessionContent}
							onContinue={openWorkspace}
							onPromptClick={queueStarterPrompt}
							onStart={openWorkspace}
							onDemo={() => queueStarterPrompt(STARTER_PROMPTS[0])}
						/>
					}
				/>
				<Route
					path="/workspace"
					element={
						<WorkspacePage
							currentState={currentState}
							draft={draft}
							hasUserMessage={hasUserMessage}
							isListening={isListening}
							isSending={isSending}
							onBack={() => navigate("/")}
							onDraftChange={(value) => {
								setDraft(value);
								autoResizeTextarea(userInputRef.current, value);
							}}
							onGenerate={generateLaunchPack}
							onReset={resetSession}
							onSend={() => void sendMessage()}
							onToggleVoice={toggleVoiceInput}
							pendingAssistantMessage={pendingAssistantMessage}
							voiceStatus={voiceStatus}
							chatScrollRef={chatScrollRef}
							userInputRef={userInputRef}
						/>
					}
				/>
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</div>
	);
}

interface LandingPageProps {
	hasSessionContent: boolean;
	onContinue: () => void;
	onPromptClick: (prompt: string) => void;
	onStart: () => void;
	onDemo: () => void;
}

function LandingPage({
	hasSessionContent,
	onContinue,
	onPromptClick,
	onStart,
	onDemo,
}: LandingPageProps) {
	return (
		<div className="space-y-4">
			<header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div className="space-y-2">
					<div className="section-chip">LaunchLens AI</div>
					<div className="font-serif text-xl text-slate-900">AI Product Wedge Studio</div>
					<p className="max-w-2xl text-sm text-slate-600">
						Sharper than a chat transcript, lighter than a no-code builder, and purpose-built for the Cloudflare AI app rubric.
					</p>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row">
					<button className="primary-button" type="button" onClick={onStart}>
						Open Workspace
					</button>
					{hasSessionContent ? (
						<button className="secondary-button" type="button" onClick={onContinue}>
							Continue Session
						</button>
					) : null}
				</div>
			</header>

			<div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_380px]">
				<section className="glass-card relative overflow-hidden bg-[linear-gradient(180deg,rgba(255,247,241,0.98),rgba(255,252,249,0.92))] p-6 sm:p-8">
					<div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_320px]">
						<div className="space-y-6">
							<div className="section-chip">Cloudflare-Native AI App</div>
							<h1 className="max-w-[8ch] font-serif text-[clamp(2.8rem,8vw,6rem)] leading-[0.92] text-slate-900">
								Find the wedge. Shape the pitch. Build the launch pack.
							</h1>
							<p className="max-w-2xl text-lg leading-8 text-slate-600">
								LaunchLens uses Llama 3.3 for live strategy chat, a Durable Object for memory, and Workflows for generation. The product is split into a clean landing page and a dedicated workspace so it feels like a real app, not a stretched demo.
							</p>
							<div className="flex flex-wrap gap-3">
								<button className="primary-button flex items-center gap-2" type="button" onClick={onStart}>
									Start From Scratch <ArrowRight className="size-4" />
								</button>
								<button className="secondary-button flex items-center gap-2" type="button" onClick={onDemo}>
									<Wand2 className="size-4" /> Load Sample Prompt
								</button>
							</div>
							<div className="grid gap-4 lg:grid-cols-3">
								<StoryCard
									icon={<BrainCircuit className="size-5 text-orange-600" />}
									title="Pressure-test the idea"
									copy="Use chat or voice to sharpen the target user, problem, MVP scope, and risk."
								/>
								<StoryCard
									icon={<Sparkles className="size-5 text-emerald-600" />}
									title="Keep persistent memory"
									copy="The Durable Object stores the launch snapshot so the brief survives refreshes."
								/>
								<StoryCard
									icon={<Wand2 className="size-5 text-amber-600" />}
									title="Generate a launch pack"
									copy="A workflow turns saved state into a concept preview, strategy, checklist, and forecast."
								/>
							</div>
						</div>
						<div className="space-y-4">
							<InfoCard
								title="Best fit"
								copy="This works best for AI workflow tools, vertical copilots, and niche SaaS ideas where the first release needs a believable entry wedge."
							/>
							<InfoCard
								title="Why it feels faster"
								copy="The LLM handles live product strategy in chat. The workflow then assembles the launch pack from saved state instead of asking the model to build a whole site from scratch."
							/>
							<div className="panel-card space-y-4 p-5">
								<div className="section-chip">Try A Prompt</div>
								<div className="space-y-3">
									{STARTER_PROMPTS.map((prompt) => (
										<button
											key={prompt}
											type="button"
											onClick={() => onPromptClick(prompt)}
											className="w-full rounded-[22px] border border-orange-200 bg-orange-50/80 p-4 text-left transition hover:border-orange-300 hover:bg-orange-50"
										>
											<span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">
												Sample Prompt
											</span>
											<span className="text-base leading-7 text-slate-800">{prompt}</span>
										</button>
									))}
								</div>
							</div>
						</div>
					</div>
				</section>

				<aside className="glass-card p-6">
					<div className="space-y-5">
						<div className="section-chip">Rubric Coverage</div>
						<div className="flex flex-wrap gap-2">
							{["Workers AI LLM", "Worker + Workflow", "Chat + Voice", "Durable Object Memory"].map((item) => (
								<span
									key={item}
									className="rounded-full bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-700"
								>
									{item}
								</span>
							))}
						</div>
						<InfoCard
							title="What reviewers can verify"
							copy="They can inspect a real chat loop, see memory update, trigger workflow coordination, and refresh to confirm persistence."
						/>
						<InfoCard
							title="Modern frontend stack"
							copy="The UI now runs on React + TypeScript + Tailwind through Vite while the backend remains a Worker with Durable Objects and Workflows."
						/>
					</div>
				</aside>
			</div>
		</div>
	);
}

interface WorkspacePageProps {
	currentState: ProjectState | null;
	draft: string;
	hasUserMessage: boolean;
	isListening: boolean;
	isSending: boolean;
	onBack: () => void;
	onDraftChange: (value: string) => void;
	onGenerate: () => void;
	onReset: () => void;
	onSend: () => void;
	onToggleVoice: () => void;
	pendingAssistantMessage: string | null;
	voiceStatus: string;
	chatScrollRef: RefObject<HTMLDivElement | null>;
	userInputRef: RefObject<HTMLTextAreaElement | null>;
}

function WorkspacePage({
	currentState,
	draft,
	hasUserMessage,
	isListening,
	isSending,
	onBack,
	onDraftChange,
	onGenerate,
	onReset,
	onSend,
	onToggleVoice,
	pendingAssistantMessage,
	voiceStatus,
	chatScrollRef,
	userInputRef,
}: WorkspacePageProps) {
	const workflowStatus = currentState?.workflowStatus.status ?? "idle";

	return (
		<div className="space-y-4">
			<header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
				<div className="space-y-2">
					<div className="section-chip">LaunchLens Workspace</div>
					<h1 className="font-serif text-3xl text-slate-900">
						Pressure-test the idea, then generate the launch pack.
					</h1>
					<p className="max-w-2xl text-slate-600">
						Chat on the left, reviewer-ready output on the right.
					</p>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row">
					<button className="secondary-button" type="button" onClick={onBack}>
						Back To Landing
					</button>
					<button
						className="primary-button"
						type="button"
						onClick={onGenerate}
						disabled={!hasUserMessage || isSending || workflowStatus === "running"}
					>
						{workflowStatus === "running" ? "Building Launch Pack..." : "Build Launch Pack"}
					</button>
					<button className="secondary-button" type="button" onClick={onReset}>
						New Session
					</button>
				</div>
			</header>

			<div className="grid gap-4 xl:grid-cols-[430px_minmax(0,1fr)]">
				<section className="glass-card flex min-h-[640px] flex-col p-4 xl:sticky xl:top-4 xl:h-[76vh]">
					<div className="border-b border-slate-200 px-2 pb-4">
						<h2 className="font-serif text-2xl text-slate-900">Strategy Chat</h2>
						<p className="mt-2 text-sm leading-6 text-slate-600">
							Describe the user, workflow, and problem until the first release feels specific enough to pitch.
						</p>
					</div>

					<div ref={chatScrollRef} className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
						{currentState?.messages.map((message, index) => (
							<MessageBubble key={`${message.role}-${index}`} role={message.role} content={message.content} />
						))}
						{pendingAssistantMessage !== null ? (
							<MessageBubble role="assistant" content={pendingAssistantMessage || "Shaping the clearest wedge and next move..."} isStreaming />
						) : null}
					</div>

					<div className="border-t border-slate-200 px-2 pt-4">
						<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
							<div className="space-y-2">
								<textarea
									ref={userInputRef}
									value={draft}
									onChange={(event) => onDraftChange(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === "Enter" && !event.shiftKey) {
											event.preventDefault();
											onSend();
										}
									}}
									rows={1}
									placeholder="Describe the AI product, workflow, or niche service copilot you want to validate..."
									className="min-h-[112px] w-full rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-base leading-7 text-slate-900 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
								/>
								<p className="text-sm text-slate-500">{voiceStatus}</p>
							</div>
							<div className="grid gap-2">
								<button className="secondary-button flex items-center justify-center gap-2" type="button" onClick={onToggleVoice} disabled={isSending}>
									<Mic className="size-4" />
									{isListening ? "Stop Voice" : "Voice"}
								</button>
								<button className="primary-button flex items-center justify-center gap-2" type="button" onClick={onSend} disabled={isSending}>
									<ArrowRight className="size-4" />
									Send
								</button>
							</div>
						</div>
					</div>
				</section>

				<div className="space-y-4">
					<section className="glass-card flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
						<div>
							<div className="section-chip">Launch Pack Output</div>
							<p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
								One workflow turns the saved product brief into a concept preview, positioning, and execution plan.
							</p>
						</div>
						<StatusPill state={workflowStatus} error={currentState?.workflowStatus.error ?? null} />
					</section>

					<section className="glass-card p-5">
						{currentState?.websitePrototype?.html ? (
							<div className="space-y-4">
								<div className="panel-card p-5">
									<div className="section-chip">Concept Preview</div>
									<h2 className="mt-3 font-serif text-3xl text-slate-900">
										{currentState.websitePrototype.title}
									</h2>
									<p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600">
										{currentState.websitePrototype.summary}
									</p>
								</div>
								<div className="overflow-hidden rounded-[28px] border border-orange-100 bg-[linear-gradient(180deg,rgba(255,240,232,0.96),rgba(255,247,241,0.92))] p-4">
									<iframe
										title="Generated concept preview"
										srcDoc={currentState.websitePrototype.html}
										sandbox="allow-scripts"
										className="h-[620px] w-full rounded-[24px] border border-slate-200 bg-white"
									/>
								</div>
								<div className="grid gap-4 lg:grid-cols-2">
									<SummaryCard title="Summary" value={currentState.launchBrief?.summary ?? ""} />
									<SummaryCard title="Audience" value={currentState.launchBrief?.audience ?? ""} />
									<SummaryCard title="Value Proposition" value={currentState.launchBrief?.valueProposition ?? ""} />
									<SummaryCard title="Launch Strategy" value={currentState.launchBrief?.launchStrategy ?? ""} />
									<SummaryCard title="Success Metric" value={currentState.launchBrief?.successMetric ?? ""} />
									<div className="panel-card p-5">
										<h3 className="font-serif text-xl text-slate-900">30-Day Checklist</h3>
										<ul className="mt-3 space-y-3 text-slate-700">
											{currentState.checklist.map((item) => (
												<li key={item} className="flex gap-3">
													<span className="mt-2 size-2 rounded-full bg-orange-500" />
													<span>{item}</span>
												</li>
											))}
										</ul>
									</div>
									<div className="panel-card p-5 lg:col-span-2">
										<h3 className="font-serif text-xl text-slate-900">Illustrative Forecast</h3>
										<div className="mt-4">
											<ForecastChart points={currentState.forecast} />
										</div>
										<p className="mt-3 text-sm text-slate-500">
											Illustrative traction forecast generated from the current strategy.
										</p>
									</div>
								</div>
							</div>
						) : (
							<div className="grid gap-4 md:grid-cols-2">
								<PlaceholderCard
									title="What gets generated"
									copy="A concept preview, audience, value proposition, launch strategy, execution checklist, and a simple traction forecast."
								/>
								<PlaceholderCard
									title="Why it feels modern"
									copy="The launch pack looks like a polished product artifact, and the workspace keeps the chat, memory, and generated output tightly connected."
								/>
							</div>
						)}
					</section>

					<section className="glass-card p-5">
						<div className="section-chip">Persistent Memory</div>
						<h2 className="mt-3 font-serif text-3xl text-slate-900">Launch Snapshot</h2>
						<p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
							The Durable Object keeps this structured brief aligned with the conversation.
						</p>
						<div className="mt-5 grid gap-4 md:grid-cols-2">
							{([
								["Idea", currentState?.ideaName],
								["One-liner", currentState?.oneLiner],
								["Target user", currentState?.targetUser],
								["Problem", currentState?.problem],
								["Solution", currentState?.solution],
								["MVP scope", currentState?.mvpScope],
								["Key features", currentState?.keyFeatures],
								["Risks", currentState?.risks],
							] as const).map(([label, value]) => (
								<div key={label} className="panel-card p-5">
									<h3 className="font-serif text-xl text-slate-900">{label}</h3>
									{Array.isArray(value) ? (
										value.length > 0 ? (
											<ul className="mt-3 space-y-2 text-slate-700">
												{value.map((item) => (
													<li key={item} className="flex gap-3">
														<span className="mt-2 size-2 rounded-full bg-emerald-500" />
														<span>{item}</span>
													</li>
												))}
											</ul>
										) : (
											<p className="mt-3 text-slate-500">This fills in as the conversation sharpens.</p>
										)
									) : value ? (
										<p className="mt-3 text-slate-700">{value}</p>
									) : (
										<p className="mt-3 text-slate-500">This fills in as the conversation sharpens.</p>
									)}
								</div>
							))}
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}

function StoryCard({
	icon,
	title,
	copy,
}: {
	icon: ReactNode;
	title: string;
	copy: string;
}) {
	return (
		<div className="panel-card p-5">
			<div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-slate-100">
				{icon}
			</div>
			<h3 className="font-serif text-xl text-slate-900">{title}</h3>
			<p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
		</div>
	);
}

function InfoCard({ title, copy }: { title: string; copy: string }) {
	return (
		<div className="panel-card p-5">
			<h3 className="font-serif text-xl text-slate-900">{title}</h3>
			<p className="mt-2 text-sm leading-7 text-slate-600">{copy}</p>
		</div>
	);
}

function MessageBubble({
	content,
	isStreaming = false,
	role,
}: {
	content: string;
	isStreaming?: boolean;
	role: "user" | "assistant";
}) {
	return (
		<article
			className={[
				"relative rounded-[24px] border p-5",
				role === "assistant"
					? "border-slate-200 bg-white/90"
					: "border-orange-200 bg-[linear-gradient(135deg,rgba(255,237,213,0.9),rgba(255,247,237,0.95))]",
			].join(" ")}
		>
			<div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">
				{role === "assistant" ? "LaunchLens" : "You"}
			</div>
			<MarkdownContent source={content} />
			{isStreaming ? (
				<div className="absolute inset-x-4 -bottom-1 h-0.5 animate-pulse bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
			) : null}
		</article>
	);
}

function PlaceholderCard({ title, copy }: { title: string; copy: string }) {
	return (
		<div className="panel-card p-6">
			<h3 className="font-serif text-2xl text-slate-900">{title}</h3>
			<p className="mt-3 text-base leading-8 text-slate-600">{copy}</p>
		</div>
	);
}

function SummaryCard({ title, value }: { title: string; value: string }) {
	return (
		<div className="panel-card p-5">
			<h3 className="font-serif text-xl text-slate-900">{title}</h3>
			<div className="mt-3">
				<MarkdownContent source={value} />
			</div>
		</div>
	);
}

function StatusPill({
	error,
	state,
}: {
	error: string | null;
	state: ProjectState["workflowStatus"]["status"];
}) {
	const label =
		state === "running"
			? "Building your launch pack..."
			: state === "complete"
				? "Launch pack ready"
				: state === "errored"
					? error || "Generation failed"
					: "Ready to generate";

	const className =
		state === "running"
			? "bg-emerald-100 text-emerald-700"
			: state === "complete"
				? "bg-orange-100 text-orange-700"
				: state === "errored"
					? "bg-rose-100 text-rose-700"
					: "bg-slate-100 text-slate-600";

	return (
		<div className={`rounded-full px-4 py-2 text-sm font-medium ${className}`}>
			{label}
		</div>
	);
}

function createClientFallbackState(): ProjectState {
	return {
		revision: 0,
		messages: [],
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
	};
}

function appendLocalAssistant(previousState: AppState, content: string) {
	const baseState = previousState ?? createClientFallbackState();
	const nextMessage: ChatMessage = { role: "assistant", content };

	return {
		...baseState,
		messages: [...baseState.messages, nextMessage],
	};
}

function getOrCreateSessionId() {
	const existing = localStorage.getItem(SESSION_STORAGE_KEY);
	if (existing) {
		return existing;
	}

	return createAndStoreSessionId();
}

function createAndStoreSessionId() {
	const nextId =
		typeof crypto.randomUUID === "function"
			? crypto.randomUUID()
			: `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
	localStorage.setItem(SESSION_STORAGE_KEY, nextId);
	return nextId;
}

function consumeSseEvents(buffer: string) {
	let normalized = buffer.replace(/\r/g, "");
	const events: string[] = [];
	let eventBoundary = normalized.indexOf("\n\n");

	while (eventBoundary !== -1) {
		const rawEvent = normalized.slice(0, eventBoundary);
		normalized = normalized.slice(eventBoundary + 2);
		const dataLines = rawEvent
			.split("\n")
			.filter((line) => line.startsWith("data:"))
			.map((line) => line.slice("data:".length).trimStart());

		if (dataLines.length > 0) {
			events.push(dataLines.join("\n"));
		}

		eventBoundary = normalized.indexOf("\n\n");
	}

	return { events, buffer: normalized };
}

function autoResizeTextarea(element: HTMLTextAreaElement | null, value: string) {
	if (!element) {
		return;
	}

	element.value = value;
	element.style.height = "auto";
	element.style.height = `${Math.min(element.scrollHeight, 220)}px`;
}

async function safeJson(response: Response) {
	try {
		return await response.json();
	} catch {
		return null;
	}
}

function isNearBottom(element: HTMLElement, threshold = 80) {
	return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}
