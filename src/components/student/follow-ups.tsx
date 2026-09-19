"use client";

import { useState } from "react";
import { ChoiceGroup } from "@/components/student/choice-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/client/language-store";
import { RED_FLAG_KEYS, type Answer, type RedFlagKey } from "@/lib/red-flags";


/**
 * Six separate questions, each Yes / No / Not sure. Untouched and "Not sure"
 * both stay unknown. Controlled by the draft so answers survive moving between steps.
 */
export function RedFlagChecklist({
  answers,
  notSure,
  onAnswer,
}: {
  answers: Record<RedFlagKey, Answer>;
  notSure: Partial<Record<RedFlagKey, true>>;
  onAnswer: (key: RedFlagKey, answer: Answer) => void;
}) {
  const { t } = useLanguage();
  const answerChoices: { label: string; value: Answer }[] = [
    { label: t.common.yes, value: true },
    { label: t.common.no, value: false },
    { label: t.common.notSure, value: null },
  ];
  const selectedIndex = (key: RedFlagKey) => {
    if (answers[key] === true) return 0;
    if (answers[key] === false) return 1;
    return notSure[key] ? 2 : null;
  };

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1 text-base font-semibold">{t.followUps.checklistLegend}</legend>
      <p className="text-sm leading-6 text-muted-foreground">
        {t.followUps.checklistHelp}
      </p>
      {RED_FLAG_KEYS.map((key) => ({ key, ...t.followUps.redFlags[key] })).map((flag) => (
        <div key={flag.key} className="flex flex-col gap-2 border-t pt-3">
          <div>
            <p className="text-sm font-medium">{flag.label}</p>
            <p className="text-xs leading-5 text-muted-foreground">{flag.description}</p>
          </div>
          <ChoiceGroup
            label={flag.label}
            choices={answerChoices}
            selected={selectedIndex(flag.key)}
            onSelect={(_index, answer) => onAnswer(flag.key, answer)}
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
  const { t } = useLanguage();
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
          { label: t.followUps.none, value: "none" as const },
          { label: t.followUps.some, value: "some" as const },
          { label: t.followUps.skip, value: null },
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
          <p className="text-xs text-muted-foreground">{t.followUps.separate}</p>
        </div>
      )}
    </fieldset>
  );
}
