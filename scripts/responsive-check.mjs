#!/usr/bin/env node
/**
 * Responsive audit (issue #60). Drives the installed Google Chrome, headless,
 * through every route and the main states of the demo at phone, tablet, and
 * desktop widths, and reports:
 *   - page-wide horizontal overflow (and the elements causing it),
 *   - content clipped sideways inside a box that hides its overflow (unreachable on a phone),
 *   - content that only fits by scrolling sideways inside its own box (a table in a narrow column),
 *   - interactive controls smaller than 44 × 44 CSS pixels,
 *   - whether the synthetic-data banner and the disclaimer are present.
 *
 *   pnpm dev                                   # in another terminal
 *   pnpm check:responsive [base-url] [--shots <dir>] [--lang es]
 *
 * Synthetic data only; it creates its own demo session. Exits non-zero on any
 * finding. It complements, and does not replace, a look on a real phone.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const shotsIndex = args.indexOf("--shots");
const shotsDir = shotsIndex >= 0 ? args[shotsIndex + 1] : null;
const flagValues = new Set(["--shots", "--lang"].map((flag) => args.indexOf(flag)).filter((index) => index >= 0).map((index) => index + 1));
const base = (args.find((arg, index) => !arg.startsWith("--") && !flagValues.has(index)) ?? "http://localhost:3000").replace(/\/$/, "");
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

// Spanish copy is longer than English, so the student-facing states are audited in it too (issue #61).
const langIndex = args.indexOf("--lang");
const lang = langIndex >= 0 && args[langIndex + 1] === "es" ? "es" : "en";
const TEXT = {
  en: { start: "Start demo session", joinLabel: "Join link for the second device", joined: "Joined demo session", describe: "What is going on today?", go: "Continue", manual: "Enter details myself", checklist: "1. Are any of these happening?", prepared: "Use prepared demo instead", consent: "Share with the demo clinic?", openPacket: "Open demo packet", available: "Available in demo", unavailable: "Packet unavailable", reset: "Reset demo" },
  es: { start: "Iniciar sesión de demostración", joinLabel: "Enlace para unir el segundo dispositivo", joined: "Se unió a la sesión de demostración", describe: "¿Qué le pasa hoy?", go: "Continuar", manual: "Escribir los datos yo mismo/a", checklist: "1. ¿Le está pasando algo de esto?", prepared: "Usar la demostración preparada", consent: "¿Compartir con la clínica de demostración?", openPacket: "Abrir el paquete de demostración", available: "Disponible en la demostración", unavailable: "Paquete no disponible", reset: "Reiniciar demostración" },
}[lang];

// 640 stands in for a 1280px desktop window at 200% zoom.
const WIDTHS = [320, 375, 390, 640, 768, 1280];
const MIN_TARGET = 44;
const BANNER = "Synthetic demo patient — fictional profile and access data.";
const DISCLAIMER = "Prototype workflow. Not medical advice. Do not enter real health information.";
const SEEDED = "I woke up with a 102 fever, my whole body aches, it started yesterday morning, and I have an exam at 2.";

async function api(method, path, token, body) {
  const response = await fetch(base + path, {
    method,
    headers: { ...(token ? { "x-demo-session": token } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.json();
}

// One session with a ready encounter (for /hcp) and a delivered packet (for /packet and the student status).
const { token } = await api("POST", "/api/demo-session");
await api("POST", "/api/intake", token, { usePreparedDemo: true, consent: { shareWithClinic: true } });
const delivered = await api("POST", "/api/intake", token, { usePreparedDemo: true, consent: { shareWithClinic: true } });
await api("POST", `/api/encounters/${delivered.encounterId}/resources`, token, { therapyId: "therapy-brand-demo" });
const attached = await api("POST", `/api/encounters/${delivered.encounterId}/attach`, token, {
  confirmed: true,
  therapyId: "therapy-brand-demo",
  pharmacyId: "pharmacy-demo-a",
  mockPrice: 45,
  instructionLanguages: ["en", "es"],
  resourceIds: ["resource-demo-copay"],
});
const sessionId = token.split(".")[0];

/** Each state: where to go, how to get the screen into that state, and what must be visible. */
const STATES = [
  { name: "home-unpaired", path: "/", paired: false, ready: `text=${TEXT.start}` },
  { name: "home-paired", path: "/", ready: `text=${TEXT.joinLabel}` },
  { name: "join", path: `/join?t=${encodeURIComponent(token)}`, paired: false, ready: `text=${TEXT.joined}` },
  { name: "student-describe", path: "/s", ready: `text=${TEXT.describe}` },
  {
    name: "student-followups",
    path: "/s",
    ready: `text=${TEXT.checklist}`,
    act: async (page) => {
      await page.getByLabel(TEXT.describe).fill(SEEDED);
      await page.getByRole("button", { name: TEXT.go, exact: true }).click();
      // Extraction may be unavailable (model quota); the manual path shows the same follow-ups.
      const manual = page.getByRole("button", { name: TEXT.manual });
      await Promise.race([
        page.getByText(TEXT.checklist).waitFor({ timeout: 40000 }),
        manual.waitFor({ timeout: 40000 }).then(() => manual.click()),
      ]);
    },
  },
  {
    name: "student-review",
    path: "/s",
    ready: `text=${TEXT.consent}`,
    act: async (page) => {
      await page.getByRole("button", { name: TEXT.prepared }).click();
    },
  },
  {
    name: "student-packet-ready",
    path: "/s",
    ready: `text=${TEXT.openPacket}`,
    storage: { [`sickday.submitted.${sessionId}`]: JSON.stringify({ encounterId: delivered.encounterId, status: "ready" }) },
  },
  { name: "packet", path: `/packet/${attached.packetId}`, ready: `text=${TEXT.available}` },
  { name: "packet-unavailable", path: "/packet/not-a-real-packet", ready: `text=${TEXT.unavailable}` },
  { name: "clinician-queue", path: "/hcp", ready: "text=Demo queue" },
  {
    name: "clinician-encounter-options",
    path: "/hcp",
    ready: "text=Unlocked for",
    act: async (page) => {
      await page.locator("ul >> role=button").filter({ hasText: "Ready" }).first().click();
      await page.getByRole("button", { name: "Show antiviral demo options" }).click();
      await page.getByText("Mock cost").first().waitFor();
      await page.getByRole("button", { name: /Show manufacturer resources for/ }).first().click();
      await page.getByText("Unlocked for").waitFor();
    },
  },
  {
    name: "clinician-confirm-dialog",
    path: "/hcp",
    ready: "role=dialog",
    act: async (page) => {
      await page.locator("ul >> role=button").filter({ hasText: "Ready" }).first().click();
      await page.getByRole("button", { name: "Show antiviral demo options" }).click();
      await page.getByRole("radio", { name: /Select Fictional Generic Antiviral Demo at Fictional Demo Pharmacy A/ }).check();
      await page.getByRole("button", { name: "Review and confirm" }).click();
    },
  },
  {
    name: "reset-dialog",
    path: "/s",
    ready: "role=dialog",
    act: async (page) => {
      await page.getByRole("button", { name: TEXT.reset }).click();
    },
  },
];

/** Runs in the page: overflow, undersized controls, and required notices. */
function measure({ minTarget, banner, disclaimer }) {
  const viewport = window.innerWidth;
  const describe = (el) => {
    const text = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.getAttribute("role") ? `[role=${el.getAttribute("role")}]` : ""} “${text}”`;
  };
  const visible = (el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
  };
  // An element may be wider than the viewport only inside a region that scrolls horizontally on its own.
  const insideScroller = (el) => {
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const overflowX = getComputedStyle(node).overflowX;
      if ((overflowX === "auto" || overflowX === "scroll") && node.scrollWidth > node.clientWidth) return true;
    }
    return false;
  };

  const pageOverflow = document.documentElement.scrollWidth - viewport;
  const offenders = [];
  if (pageOverflow > 1) {
    for (const el of document.body.querySelectorAll("*")) {
      if (!visible(el) || insideScroller(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.right > viewport + 1 && el.children.length === 0) offenders.push(`${describe(el)} → right edge ${Math.round(rect.right)}px`);
    }
  }

  // Content wider than a box that hides its overflow is cut off and cannot be reached at all.
  const clipped = [];
  for (const el of document.body.querySelectorAll("*")) {
    if (!visible(el) || ["INPUT", "TEXTAREA"].includes(el.tagName) || el.closest(".sr-only")) continue;
    const overflowX = getComputedStyle(el).overflowX;
    if ((overflowX === "hidden" || overflowX === "clip") && el.scrollWidth > el.clientWidth + 1) {
      clipped.push(`${describe(el)} → ${el.scrollWidth - el.clientWidth}px hidden`);
    }
  }

  // A box that scrolls sideways keeps the page from overflowing, but its content still does not fit:
  // the clinician's options table once lost its first two columns this way, at desktop width.
  const sideways = [];
  for (const el of document.body.querySelectorAll("*")) {
    if (!visible(el) || ["INPUT", "TEXTAREA"].includes(el.tagName)) continue;
    const overflowX = getComputedStyle(el).overflowX;
    if ((overflowX === "auto" || overflowX === "scroll") && el.scrollWidth > el.clientWidth + 8) {
      sideways.push(`${describe(el)} → ${el.scrollWidth - el.clientWidth}px wider than its box`);
    }
  }

  // A dialog covers the page; only its own controls can be tapped.
  const scope = document.querySelector('[role="dialog"]') ?? document.body;
  const small = [];
  for (const el of scope.querySelectorAll('button, a[href], input:not([type="hidden"]), textarea, select, [role="radio"], [role="checkbox"]')) {
    if (!visible(el) || el.disabled) continue;
    const rect = el.getBoundingClientRect();
    // A control counts as large enough when it, or the label that activates it, reaches the minimum.
    const label = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : el.closest("label");
    const box = [rect, label?.getBoundingClientRect()].filter(Boolean);
    const width = Math.max(...box.map((r) => r.width));
    const height = Math.max(...box.map((r) => r.height));
    if (width < minTarget - 0.5 || height < minTarget - 0.5) small.push(`${describe(el)} → ${Math.round(width)}×${Math.round(height)}`);
  }

  const text = document.body.innerText;
  return {
    pageOverflow: Math.max(0, Math.round(pageOverflow)),
    offenders: offenders.slice(0, 6),
    clipped: [...new Set(clipped)].slice(0, 6),
    sideways: [...new Set(sideways)].slice(0, 6),
    small: [...new Set(small)].slice(0, 12),
    banner: text.includes(banner),
    disclaimer: text.includes(disclaimer),
  };
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
let findings = 0;
const rows = [];

async function auditWidth(width) {
  const results = [];
  for (const state of STATES) {
    const context = await browser.newContext({
      viewport: { width, height: width >= 768 ? 900 : 760 },
      deviceScaleFactor: width >= 768 ? 1 : 2,
      hasTouch: width < 1024,
      isMobile: width < 768,
    });
    await context.addInitScript(
      ({ token, paired, storage, lang }) => {
        if (paired) window.localStorage.setItem("sickday.demoSessionToken", token);
        window.localStorage.setItem(`sickday.language.${paired ? token.split(".")[0] : "unpaired"}`, lang);
        for (const [key, value] of Object.entries(storage)) window.sessionStorage.setItem(key, value);
      },
      { token, paired: state.paired !== false, storage: state.storage ?? {}, lang },
    );
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    let result;
    try {
      await page.goto(base + state.path, { waitUntil: "domcontentloaded" });
      if (state.act) await state.act(page);
      await page.locator(state.ready).first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(300);
      result = await page.evaluate(measure, { minTarget: MIN_TARGET, banner: BANNER, disclaimer: DISCLAIMER });
      if (shotsDir) await page.screenshot({ path: `${shotsDir}/${String(width).padStart(4, "0")}-${state.name}.png`, fullPage: true });
    } catch (error) {
      result = { error: String(error.message).split("\n")[0].slice(0, 160) };
    }
    await context.close();

    const problems = [];
    if (result.error) problems.push(`could not reach state: ${result.error}`);
    else {
      if (result.pageOverflow > 1) problems.push(`page scrolls sideways by ${result.pageOverflow}px: ${result.offenders.join("; ") || "(wide container)"}`);
      if (result.clipped.length) problems.push(`content cut off: ${result.clipped.join("; ")}`);
      if (result.sideways.length) problems.push(`content scrolls sideways: ${result.sideways.join("; ")}`);
      if (result.small.length) problems.push(`controls under ${MIN_TARGET}px: ${result.small.join("; ")}`);
      if (!result.banner) problems.push("synthetic-data banner missing");
      if (!result.disclaimer) problems.push("disclaimer missing");
    }
    results.push({ width, state: state.name, problems });
  }
  return results;
}

for (const widthRows of await Promise.all(WIDTHS.map(auditWidth))) {
  for (const row of widthRows) {
    findings += row.problems.length;
    rows.push(row);
  }
}
await browser.close();

console.log(`\nResponsive audit of ${base} (${lang}) — ${WIDTHS.join(", ")} px × ${STATES.length} states\n`);
for (const row of rows) {
  if (row.problems.length === 0) continue;
  console.log(`✗ ${String(row.width).padStart(4)}px  ${row.state}`);
  for (const problem of row.problems) console.log(`      ${problem}`);
}
const clean = rows.filter((row) => row.problems.length === 0).length;
console.log(`\n${clean}/${rows.length} screen states clean; ${findings} finding${findings === 1 ? "" : "s"}.`);
if (shotsDir) console.log(`Screenshots: ${shotsDir}`);
process.exit(findings === 0 ? 0 : 1);
