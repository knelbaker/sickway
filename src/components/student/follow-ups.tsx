"use client";

import { useState } from "react";
import { ChoiceGroup } from "@/components/student/choice-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RED_FLAG_DEFINITIONS, type Answer, type RedFlagKey } from "@/lib/red-flags";

const ANSWERS = [
  { label: "Yes", value: true },
  { label: "No", value: false },
  { label: "Not sure", value: null },
] satisfies { label: string; value: Answer }[];

/** Six separate questions, each Yes / No / Not sure. Untouched and "Not sure" both stay unknown. */
export function RedFlagChecklist({
  onAnswer,
}: {
  onAnswer: (key: RedFlagKey, answer: Answer) => void;
}) {
  const [selected, setSelected] = useState<Partial<Record<RedFlagKey, number>>>({});

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1 text-base font-semibold">1. Are any of these happening?</legend>
      <p className="text-sm leading-6 text-muted-foreground">
        Answer each one. “Not sure” is a fine answer, and skipped items stay unanswered. This is a
        prototype checklist, not a validated medical screening.
      </p>
      {RED_FLAG_DEFINITIONS.map((flag) => (
        <div key={flag.key} className="flex flex-col gap-2 border-t pt-3">
          <div>
            <p className="text-sm font-medium">{flag.label}</p>
            <p className="text-xs leading-5 text-muted-foreground">{flag.description}</p>
          </div>
          <ChoiceGroup
            label={flag.label}
            choices={ANSWERS}
            selected={selected[flag.key] ?? null}
            onSelect={(index, answer) => {
              setSelected((current) => ({ ...current, [flag.key]: index }));
              onAnswer(flag.key, answer);
            }}
          />
        </div>
      ))}
    </fieldset>
  );
}

function parseList(text: string): string[] {
  return text.split(",").map((item) => item.trim()).filter(Boolean);
}

/**
 * "None" stores []; naming items stores the list; leaving it alone stores null.
 * An empty "Yes" box is still unanswered, never "none".
 */
export function ListQuestion({
  number,
  legend,
  inputLabel,
  placeholder,
  value,
  onChange,
}: {
  number: number;
  legend: string;
  inputLabel: string;
  placeholder: string;
  value: string[] | null;
  onChange: (value: string[] | null) => void;
}) {
  const [mode, setMode] = useState<"none" | "some" | null>(
    value === null ? null : value.length === 0 ? "none" : "some",
  );
  const [text, setText] = useState(value?.join(", ") ?? "");
  const inputId = `list-question-${number}`;

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-base font-semibold">
        {number}. {legend}
      </legend>
      <ChoiceGroup
        label={legend}
        choices={[
          { label: "None", value: "none" as const },
          { label: "Yes", value: "some" as const },
          { label: "Skip", value: null },
        ]}
        selected={mode === "none" ? 0 : mode === "some" ? 1 : null}
        onSelect={(_index, next) => {
          setMode(next);
          if (next === "none") onChange([]);
          else if (next === "some") onChange(parseList(text).length > 0 ? parseList(text) : null);
          else onChange(null);
        }}
      />
      {mode === "some" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={inputId}>{inputLabel}</Label>
          <Input
            id={inputId}
            value={text}
            placeholder={placeholder}
            className="h-11"
            onChange={(event) => {
              setText(event.target.value);
              const items = parseList(event.target.value);
              onChange(items.length > 0 ? items : null);
            }}
          />
          <p className="text-xs text-muted-foreground">Separate items with commas. Fictional answers only.</p>
        </div>
      )}
    </fieldset>
  );
}
