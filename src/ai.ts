import {
	LaunchArtifacts,
	LaunchBrief,
	ProjectState,
	PitchDeckSlide,
	ForecastPoint,
	WebsitePrototype,
} from "./types";
import { trimConversation } from "./state";

export const CHAT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const CHAT_SYSTEM_PROMPT = `
You are LaunchLens, a practical AI product strategist inside a Cloudflare demo app.

Your job:
- help the user turn a rough product idea into a believable MVP and launch wedge
- ask focused follow-up questions only when they unlock a real product decision
- give concrete, founder-friendly recommendations instead of generic brainstorming
- make smart assumptions when the user is vague, but label them as assumptions
- keep responses structured, practical, and concise

Always optimize for:
- target user clarity
- problem and solution fit
- a realistic MVP
- launchable next steps within 30 days

Response style:
- use short markdown headings or bold labels when helpful
- prefer 2 to 4 bullets over long paragraphs
- end with the single highest-leverage next move
- avoid filler, hype, and repeated caveats
`.trim();

interface LaunchPlanPayload {
	launchBrief: LaunchBrief;
	checklist: string[];
	pitchDeck: PitchDeckSlide[];
	forecast: ForecastPoint[];
}

function pickTopItems(items: string[], fallback: string[], limit: number): string[] {
	return (items.length > 0 ? items : fallback).slice(0, limit);
}

export function buildChatMessages(state: ProjectState) {
	return [
		{ role: "system" as const, content: CHAT_SYSTEM_PROMPT },
		...trimConversation(state.messages).map((message) => ({
			role: message.role,
			content: message.content,
		})),
	];
}

function slugToTitle(source: string): string {
	return source
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 5)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function renderList(items: string[]): string {
	return items
		.slice(0, 4)
		.map((item) => `<li>${escapeHtml(item)}</li>`)
		.join("");
}

function buildConceptPreview(state: ProjectState, brief: LaunchBrief): WebsitePrototype {
	const title = state.ideaName || slugToTitle(state.oneLiner || "Launch Prototype");
	const features = state.keyFeatures.length > 0
		? state.keyFeatures
		: ["Core workflow", "Smart onboarding", "Launch-ready interface"];
	const scope = state.mvpScope.length > 0
		? state.mvpScope
		: ["First-time user flow", "Primary action", "Clear value moment"];
	const primaryColor = "#d36639";
	const accentColor = "#2f7a72";

	const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { --bg: #f5efe4; --paper: rgba(255,250,244,.94); --ink: #17304a; --soft: #5f7080; --accent: ${primaryColor}; --accent2: ${accentColor}; --edge: rgba(23,48,74,.1); }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Avenir Next", Arial, sans-serif; color: var(--ink); background:
      radial-gradient(circle at top left, rgba(211,102,57,.16), transparent 30%),
      radial-gradient(circle at right, rgba(47,122,114,.12), transparent 24%),
      linear-gradient(180deg, #fff8ef, #f2e6d3); }
    .page { max-width: 1120px; margin: 0 auto; padding: 28px 18px 56px; }
    .hero, .panel { background: var(--paper); border: 1px solid var(--edge); border-radius: 28px; box-shadow: 0 18px 40px rgba(23,48,74,.08); }
    .hero { padding: 28px; display: grid; grid-template-columns: 1.15fr .85fr; gap: 18px; }
    .kicker { display:inline-block; padding: 8px 12px; border-radius:999px; background: rgba(211,102,57,.12); color: var(--accent); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
    h1,h2,h3 { font-family: "Iowan Old Style", Georgia, serif; margin: 0; }
    h1 { font-size: clamp(2.3rem, 4vw, 4.1rem); line-height: .94; margin-top: 14px; max-width: 9ch; }
    p { color: var(--soft); line-height: 1.6; }
    .subcopy { max-width: 34rem; margin-top: 12px; }
    .cta { display:inline-block; margin-top: 12px; padding: 12px 18px; border-radius: 999px; background: linear-gradient(135deg, var(--accent), #e28745); color: white; text-decoration:none; font-weight: 600; }
    .grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin-top: 18px; }
    .panel { padding: 20px; }
    ul { margin: 10px 0 0; padding-left: 18px; color: var(--soft); }
    .mini-app { padding: 18px; border-radius: 24px; background: linear-gradient(180deg, rgba(47,122,114,.14), rgba(255,255,255,.86)); }
    .mini-card { padding: 14px; border-radius: 16px; background: white; border: 1px solid rgba(23,48,74,.08); margin-top: 12px; }
    .pill-row { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .pill { padding:8px 12px; border-radius:999px; background: rgba(47,122,114,.12); color: var(--accent2); font-size: 14px; }
    .scoreboard { display:grid; gap: 12px; margin-top: 18px; }
    .score { padding: 14px 16px; border-radius: 18px; background: rgba(255,255,255,.72); border: 1px solid rgba(23,48,74,.08); }
    .score strong { display:block; font-size: 1rem; color: var(--ink); }
    .score span { display:block; margin-top: 4px; font-size: .92rem; color: var(--soft); }
    @media (max-width: 840px) { .hero, .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <div>
        <span class="kicker">Concept Preview</span>
        <h1>${escapeHtml(title)}</h1>
        <p class="subcopy">${escapeHtml(brief.summary || state.oneLiner || "An AI-powered product prototype.")}</p>
        <a href="#prototype" class="cta">Review the Wedge</a>
        <div class="pill-row">
          <span class="pill">${escapeHtml(state.targetUser || "Early adopters")}</span>
          <span class="pill">${escapeHtml(brief.successMetric || "Launch metric")}</span>
        </div>
        <div class="scoreboard">
          <div class="score">
            <strong>Primary pain point</strong>
            <span>${escapeHtml(state.problem || "A workflow that is still too manual or fragmented.")}</span>
          </div>
          <div class="score">
            <strong>Why this wedge is credible</strong>
            <span>${escapeHtml(brief.launchStrategy || "Start with one narrow segment and prove a repeatable first win.")}</span>
          </div>
        </div>
      </div>
      <div class="mini-app" id="prototype">
        <h3>First User Experience</h3>
        <p>${escapeHtml(state.solution || brief.valueProposition || "A fast interface for the main user workflow.")}</p>
        <div class="mini-card">
          <strong>First-release flow</strong>
          <ul>${renderList(scope)}</ul>
        </div>
        <div class="mini-card">
          <strong>What ships in V1</strong>
          <ul>${renderList(features)}</ul>
        </div>
      </div>
    </section>
    <section class="grid">
      <article class="panel">
        <h2>Why users care</h2>
        <p>${escapeHtml(state.problem || brief.audience || "The prototype focuses on a meaningful user problem.")}</p>
      </article>
      <article class="panel">
        <h2>Launch angle</h2>
        <p>${escapeHtml(brief.launchStrategy || "Start with a narrow wedge and iterate quickly with real users.")}</p>
      </article>
    </section>
  </div>
</body>
</html>`;

	return {
		title,
		summary:
			brief.summary ||
			state.oneLiner ||
			"A responsive single-file prototype generated from the idea snapshot.",
		html,
	};
}

function buildFallbackLaunchPlan(state: ProjectState): LaunchPlanPayload {
	const productName = state.ideaName || slugToTitle(state.oneLiner || "Idea Launch");
	const targetUser =
		state.targetUser || "Early adopters described during the brainstorming session";
	const problem =
		state.problem || "The target user still relies on slower or more fragmented workflows.";
	const solution =
		state.solution ||
		state.oneLiner ||
		"An AI-assisted product that compresses a complex workflow into a simpler first experience.";
	const mvpScope = pickTopItems(
		state.mvpScope,
		[
			"Landing page plus clear first-time user flow",
			"One core action that proves the value",
			"Simple onboarding and feedback capture",
		],
		3,
	);
	const features = pickTopItems(
		state.keyFeatures,
		[
			"Guided onboarding",
			"Single high-signal primary workflow",
			"Simple progress feedback",
		],
		4,
	);
	const risks = pickTopItems(
		state.risks,
		[
			"Need to validate that users care enough to return.",
			"Scope can expand too quickly without a tight MVP.",
			"Messaging may be too broad before the first niche is proven.",
		],
		3,
	);

	return {
		launchBrief: {
			summary: `${productName} is a focused MVP for ${targetUser.toLowerCase()} that turns "${problem.toLowerCase()}" into a clearer first-use experience.`,
			audience: targetUser,
			valueProposition: solution,
			launchStrategy:
				"Start with one narrow user segment, demo the core workflow live, and collect design-partner feedback before widening the positioning.",
			successMetric:
				"First-week activation rate and repeat usage among the first cohort of users.",
		},
		checklist: [
			"Ship the landing page and core walkthrough.",
			"Recruit 5 to 10 design-partner users.",
			"Measure first-session completion and repeat usage.",
			"Tighten copy around the main user pain point.",
			"Prioritize the next feature based on observed friction.",
		],
		pitchDeck: [
			{
				title: "Problem",
				headline: problem,
				bullets: [
					`${targetUser} need a faster path to value.`,
					"Current workflows are more manual or fragmented than they should be.",
				],
			},
			{
				title: "Solution",
				headline: solution,
				bullets: features,
			},
			{
				title: "MVP",
				headline: "Start with a narrow wedge and prove the core workflow first.",
				bullets: mvpScope,
			},
			{
				title: "Launch",
				headline: "Use a small cohort, real demos, and tight feedback loops.",
				bullets: risks,
			},
		],
		forecast: [
			{ label: "Week 1", value: 8 },
			{ label: "Week 2", value: 18 },
			{ label: "Week 3", value: 30 },
			{ label: "Week 4", value: 45 },
			{ label: "Week 5", value: 60 },
		],
	};
}

export async function generateLaunchPlan(
	_env: Pick<Cloudflare.Env, "AI">,
	state: ProjectState,
): Promise<LaunchPlanPayload> {
	return buildFallbackLaunchPlan(state);
}

export async function generateLaunchArtifacts(
	env: Pick<Cloudflare.Env, "AI">,
	state: ProjectState,
): Promise<LaunchArtifacts> {
	const plan = await generateLaunchPlan(env, state);
	const websitePrototype = buildConceptPreview(state, plan.launchBrief);

	return {
		launchBrief: plan.launchBrief,
		checklist: plan.checklist,
		pitchDeck: plan.pitchDeck,
		forecast: plan.forecast,
		websitePrototype,
	};
}
