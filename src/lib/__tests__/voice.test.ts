import { existsSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fixtures } from "@/lib/fixtures";
import { briefAudioMode, matchesPreparedScript, normalizeScript, PREPARED_BRIEF_AUDIO_SRC } from "@/lib/voice";

const prepared = fixtures.brief.sbar.spokenScript;

describe("matchesPreparedScript", () => {
  it("matches the prepared script regardless of case, punctuation, and spacing", () => {
    expect(matchesPreparedScript(prepared, prepared)).toBe(true);
    expect(matchesPreparedScript(`  ${prepared.toUpperCase().replace(/\./g, " . ")}  `, prepared)).toBe(true);
  });

  it("does not match once any spoken word or number differs", () => {
    expect(matchesPreparedScript(prepared.replace("102", "100.4"), prepared)).toBe(false);
    expect(matchesPreparedScript(prepared.replace("whole-body aches", "sore throat"), prepared)).toBe(false);
    expect(matchesPreparedScript(`${prepared} Also reports a cough.`, prepared)).toBe(false);
  });

  it("never matches an empty script", () => {
    expect(matchesPreparedScript("", "")).toBe(false);
    expect(normalizeScript("  ...  ")).toBe("");
  });
});

describe("briefAudioMode", () => {
  it("uses the prepared recording only for the matching script", () => {
    expect(briefAudioMode(prepared, prepared, { speechSynthesis: true })).toBe("prepared_recording");
    expect(briefAudioMode(prepared, prepared, { speechSynthesis: false })).toBe("prepared_recording");
  });

  it("speaks a changed brief with the browser instead of reusing the recording", () => {
    expect(briefAudioMode(prepared.replace("102", "100.4"), prepared, { speechSynthesis: true })).toBe("browser_speech");
  });

  it("reports audio unavailable when a changed brief cannot be spoken", () => {
    expect(briefAudioMode("A different brief.", prepared, { speechSynthesis: false })).toBe("unavailable");
  });

  it("falls back from a failed recording to speech, or to unavailable", () => {
    expect(briefAudioMode(prepared, prepared, { speechSynthesis: true, preparedFileFailed: true })).toBe("browser_speech");
    expect(briefAudioMode(prepared, prepared, { speechSynthesis: false, preparedFileFailed: true })).toBe("unavailable");
  });
});

describe("prepared recording file", () => {
  it("exists in public/ at the path the player uses", () => {
    const file = `public${PREPARED_BRIEF_AUDIO_SRC}`;

    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeGreaterThan(10_000);
  });
});
