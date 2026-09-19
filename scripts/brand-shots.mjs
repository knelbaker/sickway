#!/usr/bin/env node
/**
 * Regenerates the real app screenshots shown inside the device frames on the
 * landing page (public/brand/shot-*.png). Needs `pnpm dev` running and Google
 * Chrome installed. Synthetic data only; it creates its own demo session.
 *
 *   pnpm shots:brand [base-url]
 */
import { chromium } from "playwright-core";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const SEEDED = "I woke up with a 102 fever, my whole body aches, it started yesterday morning, and I have an exam at 2.";

async function api(method, path, token, body) {
  const response = await fetch(base + path, {
    method,
    headers: { ...(token ? { "x-demo-session": token } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.json();
}

const { token } = await api("POST", "/api/demo-session");
const waiting = await api("POST", "/api/intake", token, { usePreparedDemo: true, consent: { shareWithClinic: true } });
const delivered = await api("POST", "/api/intake", token, { usePreparedDemo: true, consent: { shareWithClinic: true } });
const attached = await api("POST", `/api/encounters/${delivered.encounterId}/attach`, token, {
  confirmed: true,
  therapyId: "therapy-generic-demo",
  pharmacyId: "pharmacy-demo-a",
  mockPrice: 12,
  instructionLanguages: ["en", "es"],
  resourceIds: [],
});

const browser = await chromium.launch({ channel: "chrome", headless: true });

async function shoot({ out, width, height, scale, mobile, path, prepare }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
  await context.addInitScript((t) => window.localStorage.setItem("sickday.demoSessionToken", t), token);
  const page = await context.newPage();
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  // Phone previews: desktop Chrome has no safe-area inset, so reserve the status-bar space a real
  // iPhone gives, for the frame's Dynamic Island. The banner's text is hidden in these previews only:
  // they are small pictures on a landing page that carries the banner itself, and the sentence is
  // unreadable at that size. The app on a real phone still shows it on every screen.
  // The frame behind the nav pill fades from cream, so no half-cut line of text shows above the pill.
  if (mobile) {
    await page.addStyleTag({
      content:
        ".sticky > div:first-child > div { padding-top: 54px !important; padding-bottom: 0 !important; } .sticky > div:first-child > div > * { display: none !important; } .sticky { background: linear-gradient(#fdf9e8 0 62%, rgba(253,249,232,0)) !important; }",
    });
  }
  await prepare(page);
  await page.waitForTimeout(600);
  // The Next.js dev indicator is not part of the product.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.screenshot({ path: `public/brand/${out}` });
  await context.close();
  console.log("saved", `public/brand/${out}`);
}

// The student's phone: their own words, about to be reviewed.
await shoot({
  out: "shot-student.png", width: 390, height: 844, scale: 2, mobile: true, path: "/s",
  prepare: async (page) => {
    const box = page.getByLabel("What is going on today?");
    await box.fill(SEEDED);
    await box.evaluate((el) => el.blur());
    await page.getByText("What is going on today?").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 215));
  },
});

// The clinician's laptop: the brief for a shared intake.
await shoot({
  out: "shot-clinician.png", width: 1200, height: 700, scale: 1, mobile: false, path: "/hcp",
  prepare: async (page) => {
    await page.locator("ul >> role=button").filter({ hasText: "Ready" }).first().click();
    await page.getByText("Clinician brief (SBAR)").waitFor();
    await page.getByRole("heading", { name: "Clinician workspace" }).evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 150));
  },
});

// The packet, back on the phone.
await shoot({
  out: "shot-packet.png", width: 390, height: 844, scale: 2, mobile: true, path: `/packet/${attached.packetId}`,
  prepare: async (page) => {
    await page.getByText("Available in demo").waitFor();
    await page.getByText("Available in demo").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 330));
  },
});

await browser.close();
void waiting;
