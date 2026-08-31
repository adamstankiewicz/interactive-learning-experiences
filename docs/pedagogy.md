# The learning science behind the design

Every structural choice in this project traces to a finding in the learning
sciences — this page names the lineage, so adopters can evaluate the design
on the discipline's own terms, and contributors know which rules are
load-bearing. Citations are to real findings; the
[what we won't claim](./index.html) policy applies here most of all.

## What the shape already encodes

**Backward design.** The pathway planner works outcome-first: it derives
learning outcomes from the verified standard's decomposition, enumerates
likely misconceptions, and only then composes steps that serve those
outcomes (Wiggins & McTighe, *Understanding by Design*). The plan document
shows coverage per outcome — including when coverage is thin — because a
plan that can't say what each step is *for* isn't a plan.

**Gradual release.** The four step purposes — `activate`, `model`,
`practice`, `check` — are the gradual-release arc ("I do, we do, you do,
show me") made machine-readable. The planner sequences them; the UI colors
them; the registry's `coverageRule` and `assesses` metadata keep a "check"
step from being built on an activity that measures nothing.

**Retrieval practice over re-reading.** Practice and check steps are built
from kinds that make the student *produce* — sort, place, argue, draft —
because testing beats restudying for retention (Roediger & Karpicke, 2006).
Reading kinds exist for the `model` beat, deliberately serif, deliberately
calm; they are never the whole pathway.

**Worked examples and cognitive load.** Step-reveal and narrated kinds are
worked examples: study-the-solution scaffolds for early acquisition (Sweller's
cognitive load framework), sequenced before independent practice rather than
after.

**Formative loops, low stakes.** Evidence drives the next decision, not a
grade: a wrong finish can inject a re-teach step immediately (Black &
Wiliam's formative assessment case, without the folklore effect sizes), the
injected step is announced as help, and it costs the student nothing — no
star lost. Struggle is information, not penalty.

**Feedback discipline.** Feedback in activities and remediation copy is
immediate, task-level, and misconception-naming — "two of your answers were
objects at rest; you're reading 'no motion' as 'no force'" — never
ego-level praise or blame (Hattie & Timperley, 2007; Kluger & DeNisi, 1996
on why person-directed feedback backfires). This is a review rule for
contributed kinds, not a style preference.

**Rich evidence over booleans.** The evidence contract carries *what the
struggle was* (`struggledWith`, attempts, per-step outcomes), because
students reach right answers through wrong reasoning and a green checkmark
hides it. Evidence structured this way is also what real efficacy research
is made of — the contract doubles as a research instrument.

**Expert review as structure.** Generated content is previewed by an adult
and assignment freezes the reviewed instance. The literature on generative
content in classrooms is unambiguous that expert review is required; here
it is architectural, not optional.

## Where this sits relative to project-based learning

This is a deliberate-practice layer, not a project platform. Gold-standard
project-based learning — sustained inquiry, authentic public products,
critique and revision over weeks — needs multi-session artifacts,
collaboration, and rubric judgment of open-ended work, none of which this
server pretends to provide. The relationship is complementary, and it is
the one the research demands: the standing critique of project-based
learning (Kirschner, Sweller & Clark on minimally guided instruction) is
that projects fail novices when underlying skills aren't explicitly
scaffolded, and PBL's own gold-standard rubrics list embedded scaffolding
as required. That scaffold is what this project is: just-in-time skill
practice a project — or the agent supporting it — can call mid-stream,
with evidence of the doing coming back. A few kinds already lean
constructive (the writing workshop's critique-and-revision cycle, the
debate), proof the registry can hold production, not just recognition.
Claiming "PBL support" beyond that would violate the labels-are-earned
rule, so we don't.

## Cautions we take from the critical literature

Justin Reich's *Failure to Disrupt* is the pre-mortem this project designs
against, and three of its warnings are load-bearing here:

- **The trap of routine assessment.** Software gravitates toward what is
  easy to assess, and a typed evidence contract could become a drill
  machine. The design pushes back — open-ended kinds carry no false
  verdicts (`correct: null` is a first-class value), generation includes
  constructive tasks, and human review is structural — but the limit is
  real: the most valuable learning stays ill-structured and human-judged,
  and this contract measures the part that can be measured, not the whole.
- **The EdTech Matthew effect.** Free tools disproportionately reach the
  already-advantaged. "Free and self-hostable" is an equity *precondition*,
  not an equity strategy; reaching under-resourced settings is distribution
  work through the institutions that serve them, and the roadmap treats it
  that way.
- **The pedagogy of poverty.** Registries don't decide which students get
  the drill kinds and which get the constructive ones — deployments do. We
  can name the risk, ship both halves of the registry, and surface usage
  honestly in reports; we cannot engineer the risk away, and won't claim
  to.

The same lab's open-source practice simulations for teachers (Teacher
Moments) are a kindred project: the practice-loop idea, aimed at teacher
learning — a reminder that "the student" in this loop need not be a child.

## Where deeper grounding lands next

These are roadmap commitments, listed so the direction is inspectable:

- **Pedagogy metadata on the registry entry** — each kind declares its
  practice type (retrieval, worked example, elaboration, generation), so
  the planner composes pathways on learning-science grounds, not variety.
- **A UDL + accessibility checklist in the widget proposal template** —
  every contributed kind answers CAST's multiple-means questions and the
  keyboard/ARIA contract the same way it must already answer `assesses`.
- **Spacing and interleaving as pathway primitives** — distributed practice
  and interleaving carry some of the largest effects in the field and are
  *scheduling* features; they arrive with saved activities.
- **Evidence tiers** — shaping the universal result so adopters can climb
  ESSA-style evidence levels (usage → correlational → causal) without
  changing instrumentation.
- **An eval harness for generation quality** — rubric-scored checks on
  generated activities, so pedagogy regressions fail builds the way type
  errors do.

## What this page will not do

No universal claims about AI tutoring outperforming teachers, no
classroom-ready-without-review claims, no d=0.4-to-0.7 formative folklore.
Where the research is conditional, the design treats the *conditions* as
requirements — that is the whole method.
