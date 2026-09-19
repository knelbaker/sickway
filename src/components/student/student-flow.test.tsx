import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ListQuestion, RedFlagChecklist } from "@/components/student/follow-ups";
import { StudentFlow } from "@/components/student/student-flow";
import { RED_FLAG_KEYS, type Answer, type RedFlagKey } from "@/lib/red-flags";
import {
  sampleExtractOutsideScenarioResponse,
  sampleExtractRequest,
  sampleExtractResponse,
} from "@/lib/api-contracts";
import { sampleIntakeRequest } from "@/lib/api-contracts";

const profile = {
  name: "Alex Demo",
  age: 20,
  planName: "Fictional Demo Out-of-State PPO",
  planMockLabel: "Mock coverage — not verified",
  instructionLanguages: ["en", "es"],
  costCeiling: 25,
  fixtureClock: "2026-09-19T10:00:00-04:00",
};

function describeSymptoms(text = sampleExtractRequest.text) {
  fireEvent.change(screen.getByLabelText("What is going on today?"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

beforeEach(() => {
  window.localStorage.setItem("sickday.demoSessionToken", "session.token");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("StudentFlow", () => {
  test("shows the synthetic profile with its source and the fixture clock before anything is typed", () => {
    render(<StudentFlow profile={profile} preparedIntake={sampleIntakeRequest.intake} />);

    expect(screen.getByText(/Alex Demo, 20/)).toBeDefined();
    expect(screen.getByText("Mock coverage — not verified")).toBeDefined();
    expect(screen.getByText("English and Spanish")).toBeDefined();
    expect(screen.getAllByText("Source: synthetic profile").length).toBe(4);
    expect(screen.getByText("September 19, 2026 at 10:00 AM")).toBeDefined();
    expect(screen.getByText("Source: demo fixture")).toBeDefined();
  });

  test("sends the text with the session token, then shows candidate fields and three follow-up groups", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(sampleExtractResponse));
    vi.stubGlobal("fetch", fetchMock);
    render(<StudentFlow profile={profile} preparedIntake={sampleIntakeRequest.intake} />);

    describeSymptoms();

    expect(await screen.findByText("Picked up from what you wrote")).toBeDefined();
    expect(screen.getByText("fever, whole body aches")).toBeDefined();
    expect(screen.getByText("102°F")).toBeDefined();
    expect(screen.getByText(/not confirmed/)).toBeDefined();
    expect(screen.getByText("1. Are any of these happening?")).toBeDefined();
    expect(screen.getByText("2. Have you taken any medications for this?")).toBeDefined();
    expect(screen.getByText("3. Do you have any allergies?")).toBeDefined();

    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/extract");
    expect(new Headers(init.headers).get("x-demo-session")).toBe("session.token");
    expect(JSON.parse(init.body)).toEqual({ text: sampleExtractRequest.text });
  });

  test("starts with no checklist item selected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(sampleExtractResponse)));
    render(<StudentFlow profile={profile} preparedIntake={sampleIntakeRequest.intake} />);
    describeSymptoms();
    await screen.findByText("1. Are any of these happening?");

    expect(screen.getAllByRole("radio").filter((radio) => radio.getAttribute("aria-checked") === "true")).toEqual([]);
  });

  test("stops with a visible message for input outside the demo scenario", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(sampleExtractOutsideScenarioResponse)));
    render(<StudentFlow profile={profile} preparedIntake={sampleIntakeRequest.intake} />);

    describeSymptoms("Where do I park my car for the game?");

    expect(await screen.findByText("Outside this demo scenario")).toBeDefined();
    expect(screen.queryByText("1. Are any of these happening?")).toBeNull();
    expect(screen.queryByRole("button", { name: "Enter details myself" })).toBeNull();
  });

  test("offers manual entry and invents nothing when extraction fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ error: "extraction_unavailable" }, { status: 503 })),
    );
    render(<StudentFlow profile={profile} preparedIntake={sampleIntakeRequest.intake} />);

    describeSymptoms();
    fireEvent.click(await screen.findByRole("button", { name: "Enter details myself" }));

    expect(await screen.findByText("Nothing was filled in automatically")).toBeDefined();
    const summary = screen.getByRole("region", { name: "Nothing was filled in automatically" });
    expect(within(summary).getAllByText("not reported").length).toBe(4);
    expect(within(summary).queryByText("102°F")).toBeNull();
  });

  test("does not submit an empty description", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<StudentFlow profile={profile} preparedIntake={sampleIntakeRequest.intake} />);

    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("RedFlagChecklist", () => {
  const unanswered = Object.fromEntries(RED_FLAG_KEYS.map((key) => [key, null])) as Record<RedFlagKey, Answer>;

  test("reports Yes, No, and Not sure as true, false, and null per item", () => {
    const onAnswer = vi.fn();
    render(<RedFlagChecklist answers={unanswered} notSure={{}} onAnswer={onAnswer} />);
    const group = (name: string) => screen.getByRole("radiogroup", { name });

    fireEvent.click(within(group("Sudden severe headache")).getByRole("radio", { name: "Yes" }));
    fireEvent.click(within(group("Confusion or fainting")).getByRole("radio", { name: "No" }));
    fireEvent.click(within(group("Stiff neck or new rash")).getByRole("radio", { name: "Not sure" }));

    expect(onAnswer.mock.calls).toEqual([
      ["sudden_severe_headache", true],
      ["confusion_fainting", false],
      ["stiff_neck_rash", null],
    ]);
    expect(screen.getAllByRole("radiogroup")).toHaveLength(6);
  });

  test("shows an untouched item as unselected and an explicit Not sure as selected", () => {
    render(
      <RedFlagChecklist
        answers={{ ...unanswered, dehydration: false }}
        notSure={{ stiff_neck_rash: true }}
        onAnswer={vi.fn()}
      />,
    );
    const checked = (group: string, name: string) =>
      within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", { name }).getAttribute("aria-checked");

    expect(checked("Dehydration or unable to keep liquids down", "No")).toBe("true");
    expect(checked("Stiff neck or new rash", "Not sure")).toBe("true");
    expect(checked("Confusion or fainting", "Not sure")).toBe("false");
    expect(checked("Confusion or fainting", "No")).toBe("false");
  });
});

describe("ListQuestion", () => {
  function renderQuestion(onChange = vi.fn()) {
    render(
      <ListQuestion
        number={2}
        legend="Have you taken any medications for this?"
        inputLabel="Which medications?"
        placeholder=""
        value={null}
        onChange={onChange}
      />,
    );
    return onChange;
  }

  test("None reports an empty list", () => {
    const onChange = renderQuestion();

    fireEvent.click(screen.getByRole("radio", { name: "None" }));

    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  test("Yes with nothing typed stays unanswered, then reports the typed items", async () => {
    const onChange = renderQuestion();

    fireEvent.click(screen.getByRole("radio", { name: "Yes" }));
    expect(onChange).toHaveBeenLastCalledWith(null);

    fireEvent.change(screen.getByLabelText("Which medications?"), { target: { value: "ibuprofen,  acetaminophen ," } });
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(["ibuprofen", "acetaminophen"]));
  });

  test("Skip after None goes back to unanswered", () => {
    const onChange = renderQuestion();

    fireEvent.click(screen.getByRole("radio", { name: "None" }));
    fireEvent.click(screen.getByRole("radio", { name: "Skip" }));

    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
