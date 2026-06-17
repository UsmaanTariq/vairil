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

---

EXAMPLE OUTPUT (illustrative only — use the ACTUAL business profile above, not this bakery):

✅ STRONG IDEA — do this:
Title: "Why Sarah drives 40 minutes past Greggs to buy her sourdough here"
trendRef: "Hyper-local loyalty POV"
hook: "She passes 14 bakeries to get to ours. Here's what she told us on camera."
script: "We were setting up for the Saturday market when Sarah pulled up at 7am — again.
We asked her why she drives from Didsbury. She said: 'Your Gruyère and chive loaf is the
only one that stays chewy on day three.' That loaf takes us 54 hours to make. Cold-proof
overnight, baked in a cast-iron Dutch oven at 260°C. £5.50. We only make 18 on Saturdays.
She pre-orders two every week. Link in bio to reserve yours."
shotList:
  1. Wide — Sarah's car pulling into the market car park at 7am (handheld, golden-hour light)
  2. Medium — Sarah and baker shaking hands over the loaf counter
  3. Close-up — Gruyère and chive loaf cross-section showing open crumb (macro, natural light)
  4. B-roll — Baker scoring dough at 5am, steam rising from Dutch oven lid
  5. Text overlay: "54-hour proof. 18 loaves. Every Saturday."
audio: "Lo-fi morning acoustic, no lyrics"
caption: "She drives 40 minutes for this loaf every Saturday 🥖 Pre-order link in bio — we sell out by 9am."
hashtags: ["sourdough", "manchesterfoodie", "localbakery", "artisanbread", "saturdaymarket"]
why: "Uses a real customer's name and journey, a specific product, a measurable constraint (18 loaves),
and a concrete call to action — nothing about this could belong to another bakery."

❌ WEAK IDEA — never do this:
Title: "Behind the scenes at our bakery"
hook: "Ever wondered what happens behind the scenes at a bakery?"
why this fails: Generic enough to be posted by any of 50,000 bakeries worldwide. No specific
product, no real customer, no constraint, no reason to care.

---`;
