# AI Prompts Used

This file documents the prompts used while building this project with AI assistance.

## Product ideation

```text
I was given this challenge for a cloudflare appliaction... I want to build something quickly so lets first brainstorm a cool idea then we make a plan and then you implement this ok?
```

```text
I want something that would be easy to demo for the guys at cloudflare. They just clone it and instantly understand what it does and can use it.
```

```text
PLEASE IMPLEMENT THIS PLAN:
Build a Cloudflare-native chat app that turns a rough product idea into a concrete launch plan...
```

## Implementation guidance

```text
Use the current Worker starter, Workers AI, Durable Objects, and Workflows. Keep the UI guided and reviewer-friendly. Persist session state server-side and generate a launch brief asynchronously.
```

```text
Make the first-run experience obvious: starter prompts, a visible state panel, and an easy way to reset and try again.
```

## Verification and polish

```text
Double check everything. See if there are areas for improvement and just verify everything. Write in the read me to show how it fits the deliverable since this is for a SWE intern position application.
```

```text
Improve to make it better, robust, and check and verify everything runs as it should.
```

```text
Improve the frontend: render markdown correctly, make the chat window properly scrollable and usable above the fold, add voice input, and generate a more impressive reviewer-facing demo artifact such as a launch deck or visual forecast while still fitting the Cloudflare assignment criteria.
```

```text
Fix the voice input loop, reduce timeout risk, and upgrade the workflow so it generates a working website prototype for the product idea in addition to the launch strategy.
```

## In-app model prompts

The application itself also uses prompt instructions for Workers AI in `src/ai.ts`:

- a chat system prompt for the `Idea-to-Launch Agent`
- a structured extraction prompt for the `Launch Snapshot`
- a workflow prompt that generates the launch strategy
- a workflow prompt that generates the website prototype HTML
