# Messaging guide

How to talk about a2learn, for anyone who represents it — maintainers,
contributors, conference hallways. Published openly because a project whose
brand is honesty has nothing to hide about how it communicates. When in
doubt, say less and show the transcript.

## The sentence

One claim, three registers. Do not invent a fourth.

| Register | Use it | The line |
|---|---|---|
| Emotional | Talks, headlines, the hero | "AI tutors can talk. This makes them able to teach." |
| Technical | Developer audiences, READMEs | "Practice as a tool call — assign verified activities, get evidence of what the student did back." |
| Category | Directories, About fields, introductions | "The open activity server for teaching agents." |

## The name

**a2learn** — agent-to-learner, deliberately rhyming with A2A and A2UI so
protocol-literate readers shelve it correctly before reading a word. Always
lowercase, one word, mono-set where the medium allows. Never "A2Learn",
never "A2L" (collides with an automotive format).

## The category, and what to attach it to

"Activity server" is a new category; new categories only stick when
relentlessly attached to known ones. The two approved attachments:

- For infrastructure people: **"What OpenTelemetry is to observability,
  this is to practice"** — the loop every tutor needs and none
  differentiates on, co-maintainable by competitors.
- For education people: **"The open assessment engines — STACK, Numbas —
  proved this category; this is that, generative and agent-native."**
  ("H5P for the agent era" is acceptable shorthand with the caveat that
  H5P is a content library and this is a framework.)

## The enemy

Never a competitor. The enemy is **passive consumption of AI output**. The
one repeatable fact, phrased exactly (drift breeds misquotes):

> In a 2025 randomized trial published in PNAS, students given unguided
> ChatGPT for math practice solved 48% more practice problems — then scored
> 17% worse on the exam, while reporting they felt more prepared.

Every pitch has the same skeleton: consumption harms → the loop works →
the loop shouldn't be proprietary → here it is, Apache-2.0.

## One move per audience

| Audience | The move | The line |
|---|---|---|
| AI-tutor builders (primary) | Sell the return value | "Your agent can explain; it can't verify anything landed. Three lines of SDK and it can." |
| Platform / district evaluators | Compliance as architecture | "Stores nothing about students — not a promise, an architecture you can read." |
| Educators | The review gate and the low stakes | "Nothing reaches a student a teacher didn't review, and struggle costs nothing." |
| Contributors | The registry, never the catalog | "Your subject needs an activity kind that doesn't exist? One file." |

## What it is NOT — say it first

Not a tutor (it makes yours able to teach). Not an LMS (it plugs into what
you have). Not a content library (a registry of capabilities, not a shelf).
Not a chatbot (it is what the chatbot is missing).

## Voice rules

1. **Never overclaim.** The banned-claims list below is load-bearing. "What
   we won't claim" is a feature of the product.
2. **Framework first.** Lead with the registry API and "one file to add a
   kind." Built-in kinds are seed content — a few examples, never an
   enumerated gallery, never a count in hero position.
3. **Show, then say.** The transcript (find → ✓ verified → evidence
   returns) is the argument; prose is commentary on it.
4. **Verification green is semantic.** In any designed material, green
   appears only where something is verified — never decoration. The palette
   is the epistemology.
5. **Students do; agents adapt; teachers approve.** Every description
   should let all three subjects act. If a paragraph has only the AI doing
   things, rewrite it.
6. **Plain words.** "Activity", "evidence", "verified" — not "learning
   objects", "insights", "AI-powered".

## Claim hygiene

Approved, with sources: the PNAS finding (Bastani et al., 2025); the
Harvard practice-tutoring effect (Kestin et al., 2025, effect size near
1.0); "self-hostable, stores nothing about students" (architecture);
"Apache-2.0, cross-org" (license, provenance).

Banned, permanently: AI tutors outperform teachers; generated content is
classroom-ready without review; folklore formative-assessment effect
sizes; "marketplace" or "standard" while there is one publisher and one
implementation; any student-outcome claim about a2learn itself until real
deployments produce evidence.

## The proof hierarchy

Ten seconds: say the category sentence.
Thirty seconds: show the transcript, say the PNAS fact, say
"Apache-2.0, cross-org — born at the CodeAI education hackathon."
Two minutes: add the loop's three return edges (agent adapts, remediation
injects, teacher sees evidence) and the one-file registry story. Stop
talking; the demo answers questions better than a roadmap does.

## Boilerplate

**GitHub About / directory listing (≤120 chars):**
"The open activity server for teaching agents — verified practice out,
evidence back. Apache-2.0."

**One paragraph:**
"a2learn gives teaching agents an action space: real interactive practice,
verified against real learning standards, with evidence of what the
student did flowing back to the agent that assigned it. It ships as an
open-source MCP server, a widget registry you extend with one file, and an
evidence contract one SDK handler consumes. Self-hostable; stores nothing
about students; Apache-2.0."

**Announcement lead:**
"Chat alone doesn't teach — in a 2025 PNAS trial, students practicing with
unguided ChatGPT scored 17% worse while feeling more prepared. What works
is the loop: assign real practice, watch it get done, act on what
happened. Every AI tutor needs that loop; none differentiates on it. So we
built it once, in the open."
