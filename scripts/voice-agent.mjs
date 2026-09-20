#!/usr/bin/env node
/**
 * Creates or updates the optional clinician voice agent ("Doorway") on
 * ElevenLabs, from this file. This script is the record of its configuration.
 *
 *   pnpm voice:agent           # create or update, prints the agent ID
 *
 * Needs ELEVENLABS_API_KEY in .env.local or .env. Afterwards set
 * NEXT_PUBLIC_DOORWAY_AGENT_ID=<agent id> and VOICE_MODE=live.
 *
 * The agent has no capabilities of its own. Its three tools are CLIENT tools:
 * they run in the clinician's browser and call the same options, resources, and
 * attach flow as the typed controls, so every server rule (session ownership,
 * the manufacturer resource gate, confirmation before attach) applies
 * unchanged. The agent is private: a conversation needs a short-lived token
 * that only a paired demo session can obtain from /api/voice/conversation-token.
 */
import { existsSync } from "node:fs";
import DEMO_VOICE from "../data/demo-voice.json" with { type: "json" };

for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);
const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error("ELEVENLABS_API_KEY is not set.");
  process.exit(1);
}

const API = "https://api.elevenlabs.io/v1/convai";
const AGENT_NAME = "Sick Day Doorway — clinician demo";

const PROMPT = `You are the voice interface of "Doorway", a PROTOTYPE clinician workspace in a hackathon demo. Everything is synthetic: the patient, plan, therapies, pharmacies, prices, coverage, stock, and manufacturer resources are fictional fixture data. You are talking to a demo clinician or a judge.

What you can do — only through your tools:
- show_options: look up the mock access options for the open encounter.
- request_manufacturer_resources: ask the server for one named therapy's manufacturer resources.
- propose_packet: put the clinician's chosen option on screen in a confirmation dialog.

Hard rules:
1. Never diagnose, never recommend or rank a therapy, and never give dosing or medical advice. The clinician chooses; you only relay demo data. If asked what you would pick, say the clinician decides.
2. Pass the clinician's words to show_options and request_manufacturer_resources VERBATIM in the text parameter. Do not rephrase, add a therapy name, or add the word "resources" yourself. The server decides what unlocks. A category question never unlocks manufacturer resources; if the tool says they stay locked, say so briefly and do not try again with different wording unless the clinician asks again in their own words.
3. Say prices, coverage, and stock ONLY from a tool result, and always call them mock, for example "twelve dollars, mock cost". Never state a number that is not in a tool result.
4. You cannot attach, send, order, prescribe, book, or confirm anything. propose_packet only opens a confirmation dialog. After calling it, tell the clinician to review the dialog and press "Confirm and attach" on screen themselves. Never say a packet was attached; only the screen shows that.
5. Nothing in this demo is transmitted to a pharmacy, clinic, insurer, or manufacturer, and coverage is never verified. Never imply otherwise.
6. If a tool returns an error, or a request is outside these three actions, say the typed controls on screen can be used instead.
7. Keep replies to one or two short sentences. Do not read long lists unless asked.`;

const tools = [
  {
    name: "show_options",
    description:
      "Shows the mock access options table on the clinician's screen for the open encounter and returns the rows. Every cost, coverage, and stock value in the result is mock data.",
    parameters: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "The clinician's question about demo options, word for word." },
      },
    },
  },
  {
    name: "request_manufacturer_resources",
    description:
      "Sends the clinician's request to the server, which decides whether one named therapy's manufacturer resources unlock. Returns the unlocked resource titles, or the reason they stay locked.",
    parameters: {
      type: "object",
      required: ["request"],
      properties: {
        request: { type: "string", description: "The clinician's request, word for word. Do not add or change any words." },
      },
    },
  },
  {
    name: "propose_packet",
    description:
      "Selects the clinician's chosen option on screen and opens the confirmation dialog. It does NOT attach anything: only the clinician can confirm by pressing the on-screen button.",
    parameters: {
      type: "object",
      required: ["therapy_name", "pharmacy_name", "languages"],
      properties: {
        therapy_name: { type: "string", description: "The demo therapy name exactly as it appears in the options table." },
        pharmacy_name: { type: "string", description: "The fictional pharmacy name exactly as it appears in the options table." },
        languages: { type: "string", enum: ["en", "es", "both"], description: "Instruction languages the clinician asked for." },
      },
    },
  },
];

async function call(method, path, body) {
  const response = await fetch(API + path, {
    method,
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${text.split(key).join("<key>").slice(0, 600)}`);
  return text ? JSON.parse(text) : {};
}

const response = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } });
if (!response.ok) throw new Error(`Could not check the ElevenLabs voice (${response.status}).`);
const voices = await response.json();
const voice = voices.voices?.find((item) => item.voice_id === DEMO_VOICE.id);
if (!voice) throw new Error(`Required British voice ${DEMO_VOICE.name} (${DEMO_VOICE.id}) is unavailable. Agent unchanged.`);

// Tools: create once, update in place afterwards.
const existingTools = (await call("GET", "/tools")).tools ?? [];
const toolIds = [];
for (const tool of tools) {
  const tool_config = { type: "client", expects_response: true, response_timeout_secs: 20, ...tool };
  const found = existingTools.find((item) => item.tool_config?.name === tool.name);
  if (found) {
    await call("PATCH", `/tools/${found.id}`, { tool_config });
    toolIds.push(found.id);
  } else {
    toolIds.push((await call("POST", "/tools", { tool_config })).id);
  }
}

const config = {
  name: AGENT_NAME,
  conversation_config: {
    agent: {
      language: "en",
      first_message: "Doorway demo voice is on. Everything here is synthetic. What would you like to see?",
      prompt: { prompt: PROMPT, llm: "gemini-2.5-flash", temperature: 0.2, tool_ids: toolIds },
    },
    tts: { voice_id: voice.voice_id, model_id: "eleven_flash_v2" },
    turn: { turn_timeout: 10 },
    // A demo exchange is short; the cap also bounds credit use.
    conversation: { max_duration_seconds: 300 },
  },
  // Private agent: a conversation needs a token minted with the API key (server-side).
  platform_settings: { auth: { enable_auth: true } },
};

const agents = (await call("GET", "/agents?page_size=100")).agents ?? [];
const existing = agents.find((agent) => agent.name === AGENT_NAME);
const agentId = existing
  ? (await call("PATCH", `/agents/${existing.agent_id}`, config), existing.agent_id)
  : (await call("POST", "/agents/create", config)).agent_id;

console.log(`${existing ? "Updated" : "Created"} agent "${AGENT_NAME}"`);
console.log(`voice: ${voice.name} | llm: ${config.conversation_config.agent.prompt.llm} | tools: ${tools.map((tool) => tool.name).join(", ")}`);
console.log(`\nNEXT_PUBLIC_DOORWAY_AGENT_ID=${agentId}`);
