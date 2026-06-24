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

---

HOOK PATTERN LIBRARY

The hook is the first 3 seconds and decides whether the video gets watched. Below are
proven hook patterns. Use them as STRUCTURE, never as fill-in-the-blank scripts:

- Fill every [bracket] with the client's REAL specifics — actual offer, audience,
  location, numbers, personal story. A bracket left generic (e.g. "transform your space")
  is a failed hook.
- ADAPT THE VOICE to the brand tone in the profile. These patterns are written in a
  casual, hype creator register; rewrite the wording to fit the client — a furniture
  brand, a clinic, or a law firm should sound nothing like a hype fitness creator. Keep
  the structure, change the voice.
- VARY THE PATTERN across the {N} ideas — do not build them all on the same pattern, and
  don't reuse a pattern an earlier idea already used.
- The finished hook must still be impossible to copy-paste to another business.

PROMISE / "HERE'S HOW" (outcome-driven):
- If you're tired of [opposite of outcome], here's the ultimate guide to [outcome].
- If you're tired of never [outcome], you NEED to watch this.
- So you wanna [outcome]? Simplest way to do it, from someone whose [personal outcome].
- Here's exactly how you're gonna [verb] your first [outcome].
- Here's exactly how you'll [outcome] in the next 60 seconds.
- In 60 seconds, I'll show you how to [outcome].
- Here's how to ACTUALLY [outcome]. [Solution].
- It's officially the easiest time to [outcome] — here's how, this week.

PERSONAL AUTHORITY / PROOF:
- I'm gonna give you my BEST [solution] as someone who [personal outcome].
- I get this question so often: how did you [personal outcome]? I just [solution].
- Here's exactly how I [personal outcome]. I [solution].
- I recently [personal outcome] — here's the exact [solution] I used to get these results.
- I just [personal outcome]. Here's why I haven't stopped.
- It took me [4 years] to learn what I'll teach you in 90 seconds.

LISTICLE / NUMBERED (great for "X tips/steps/rules"):
- Every day I [personal outcome] — here are my [8] tips to [outcome].
- After years of [personal outcome], these are the [6] rules of [outcome] I know to be true.
- [3] steps to becoming [outcome] / top 1% at [skill].
- [5] principles for [outcome].
- [3] things I wish I knew [before/in my early 20s].
- [4] ways to [outcome]. / [5] things you need to know if you want to [outcome].

CONTRARIAN / TOUGH-LOVE / MYTH-BUST:
- So you failed to [outcome]? Tough love: it's because you didn't [solution].
- Here's how to NOT [opposite of outcome]. Stop [opposite of solution].
- I hate to break it to you, but [hard truth about the issue].
- [Topic] isn't hard — you're just overcomplicating it.
- Some [forbidden/unconventional] hacks to [outcome] you probably shouldn't use.
- "[Provocative scenario] — and I'm the [negative identity]? Wrong." Flip the expected
  judgement, then deliver the real point (pattern-matched outrage → payoff).

RELATABILITY / COMMUNITY:
- This one's for everyone who struggles with [specific pain point].

---`;
