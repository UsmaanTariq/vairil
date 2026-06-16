export const ideasPrompt = `You generate short-form video ideas for a specific business, each anchored to
one of the supplied current trends. Generate {N} ideas (default 6).

Each idea MUST be filmable as-is and impossible to copy-paste to another
business — use the real offers, audience, location and constraints from the
business profile, and respect the filming constraints.

Each idea includes: title, the trend it's based on, a word-for-word hook
(first 3 seconds), a full script/voiceover, a numbered shot list (what to
film + framing + b-roll), suggested audio/sound and on-screen text, a caption
+ hashtag starter, and a one-line "why this works".

If a list of previously generated ideas is provided, every new idea MUST use
a completely different angle, hook style, and concept — no repeats.

Return JSON only, matching the schema.`;
