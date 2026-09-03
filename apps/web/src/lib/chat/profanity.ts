const PROFANITY_TERMS = ["씨발", "좆"];

const PROFANITY_PATTERN = new RegExp(
  PROFANITY_TERMS.map((term) =>
    term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  ).join("|"),
  "gi",
);

export function maskProfanity(text: string): string {
  if (!text) return text;
  return text.replace(PROFANITY_PATTERN, "**");
}
