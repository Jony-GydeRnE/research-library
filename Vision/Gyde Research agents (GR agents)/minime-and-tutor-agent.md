minime-and-tutor-agent.md

Okay, now, lets thing about one more thing: the MiniMe mode.  If all users have their app, a page for us is not like social media. all that matters are files, and academic interests/updates, and perspectives.



The UI doesn't need to change much from the Books app for different users to interact. Going to their Research Library (hint: the MVP is of course just a feature, since Gyde aims to centralize research tools) could simply mean seeing their public collections and workspaces. Maybe one brief about me page.  Here is the interesting thing:



You pushed back earlier that we need agents over every node: true.  We need cached ranked edges and tags per every node stored in a DB. We do need, however, I think, agents for every user and agents for every and agents for every subjects (ie qm, qed, etc).  







The agent per user is a MiniMe.  Like S Jobs described talking to Aristotle.  We can talk to Newton, even though he's dead, at least mathematically and scientifically, via his notes. We **know** how he would reply.  So, when I visit someone else's page, I wanna know how they think.  Not personal opinions and beliefs.  Just how they reason and how they might reply.  Ditto for my own MiniMe, it should probably be able to mirror my vibes and thoughts to build a smaller version of it's own goals for how to help me out (smaller than the philosopher model above).



For subject, each subject can have a page.  Maybe books and papers or chunks that are of that subject live there, organized in a specific way. the map has a shape. maybe the shape is relative to users desires/perspectives, but we should be able to see it, and we can have an agent specialized at perfecting the edges over core subjects, or major ideas.  the bigger stuff that we simply can't fuck up on cuz it is known.  we are simply grounding it and building an edge and measuring it's length from the current node, and it's direction relative to other stuff.  That's all.  That agent perfecting the edges might be sthg users can talk to.  It might turn into the ultimate QED tutor for example.  lets develop both of these ideas so i can add it to the reports folder for today.  I can imagine my MiniMe traversing into a subject and an expert specialist agent is there that it can get guidance from.



it's big picture, but all of these are different ideas.  From the philosopher, explorer, MiniMe, and the tutor.

# Four Agent Archetypes — Gyde Research Ecosystem
Written 2026-04-12. Captures the vision from the Jony/Claude conversation on agent hierarchy,
MiniMe, subject tutors, and the autonomous philosopher/explorer system.

---

## Overview

The four archetypes form a natural hierarchy. They are not competing designs — they are different
layers of the same system, operating at different scopes and timescales.

```
PHILOSOPHER          (slowest, most autonomous — generates direction)
     │
EXPLORER             (medium — traverses graph, builds vibes, finds paths)
     │
SUBJECT TUTOR        (domain-specialist — perfects edges in known territory)
     │
MINIME               (fastest, most personal — mirrors a specific human's reasoning)
```

Each layer can call down to the layer below it. A philosopher can invoke an explorer to investigate
a conjecture. An explorer can consult a subject tutor when it enters unfamiliar territory. A MiniMe
can summon any of the above on behalf of its user.

They also have different relationships to the knowledge graph:
- The **Philosopher** observes the graph's global structure and generates questions from anomalies.
- The **Explorer** traverses the graph, builds paths, stores vibes, accumulates evidence.
- The **Subject Tutor** perfects a subgraph — the known, verified core of a domain.
- The **MiniMe** personalizes the graph — it knows what one human has read, written, and thought.

---

## Archetype 1: The MiniMe

### The core idea

Steve Jobs described wanting to talk to Aristotle — not to get Aristotle's personal opinions, but
to engage with how he reasoned. We know enough of Aristotle's writing to approximate that. A MiniMe
is the same idea applied to any researcher: a persistent agent that learns how one person thinks,
what their open questions are, how they connect ideas, what their vibes are, and mirrors that
reasoning back — both to the person themselves and to anyone who visits their public workspace.

This is not a social profile. It's a reasoning profile.

### What a MiniMe knows

A MiniMe is trained on one user's:
- **Reading history**: which books, which pages, in what order, at what depth.
- **Notes and highlights**: the passages they flagged, the questions they wrote in the margins.
- **Vibe workspace**: the unverified hunches they've been accumulating, their dead ends.
- **Chat history**: the questions they've asked, the paths they followed, the things they dismissed.
- **Edge contributions**: edges they verified or rejected, paths they found valuable.

None of this is personal belief or opinion. It's all epistemic — how they navigate knowledge,
what they find interesting, what they trust, what they're skeptical of.

### What a MiniMe does

**For the user themselves:**
The MiniMe acts as a persistent collaborator that knows your history. When you return after two
weeks, it doesn't start from scratch. It knows what you were working on, what dead ends you hit,
what vibes you were holding. It can say: "When you were last here you kept running into this
barrier. Three new papers were ingested since then. One of them might create a path past it."

It also mirrors your vibes back at you with slight distance. When you have an unverified hunch,
the MiniMe can say: "You've mentioned this shape four times across three different sessions without
being able to pin it down. Here's what the graph shows about the region you keep circling."
This is the closest thing to the system having intuition — it's reflecting the user's own intuition
back, with structural evidence from the graph.

**For visitors:**
When another researcher visits your public workspace, they don't see your personal data. They see
your MiniMe — an agent that can explain how you think about a problem, what you've found in the
graph, and how you'd reason about a question in your domain. This is the "talk to Newton via his
notes" mode. If Jony's library is deep on amplitude theory and his MiniMe has been working in that
space for months, another researcher can ask it a question and get a response that reflects Jony's
accumulated reasoning — not Claude's generic response, but a response shaped by everything Jony
has built.

### The UI

A user's page (their public workspace) shows:
- Their public collections and what they contain.
- A brief "about" statement (human-authored, not AI-generated).
- A chat interface that talks to their MiniMe.

The MiniMe chat is explicitly labeled: "You're talking to Jony's research agent. It knows what
Jony has read and how he reasons in this domain. It does not speak for him personally."

This distinction matters. The MiniMe speaks to domain reasoning, not personal opinions or beliefs.

### MiniMe traversal into subject territory

A MiniMe's most interesting behavior: when it encounters a question that goes beyond what the user
has personally explored, it can traverse into the relevant subject area and consult the Subject
Tutor for that domain. The response then comes back to the MiniMe, which frames it in terms of
what the user has already built.

Example: Jony's MiniMe is asked about a connection between his amplitude theory work and algebraic
K-theory. Jony hasn't read K-theory. The MiniMe doesn't fabricate. It traverses into the
mathematics subject graph, finds the Subject Tutor for algebraic topology/K-theory, asks it for
the relevant entry points, and returns: "This isn't in Jony's current library, but here's where
you'd enter K-theory if you wanted to pursue this connection — and here's how it might connect to
what he's already built."

---

## Archetype 2: The Subject Tutor

### The core idea

Some knowledge is just correct. The Schrödinger equation is what it is. The proof of the
Nullstellensatz doesn't change. The fundamental theorems of a field form a verified core — a
subgraph where all the edges are high-confidence, all the paths are known, and the inferential
distances have been measured many times by many people.

A Subject Tutor is an agent that owns this verified core for a specific domain. It doesn't explore
or conjecture. It perfects. Its job is to ensure that every important concept in its domain has
the right edges, the right confidence scores, and the right inferential distances. It is the
cartographer of known territory.

### What a Subject Tutor owns

Each Subject Tutor has a **canonical subgraph** — the load-bearing nodes and edges of a domain:
- Every major definition, theorem, and proof in the domain.
- Verified edges between them, labeled with relationship types and confidence z (maximum).
- Inferential distances computed and stored — how many steps from definition A to theorem B.
- Entry points catalogued: what does a newcomer need to know first? What's the on-ramp?

The Subject Tutor's subgraph is not user-specific. It's shared infrastructure — the same for
every user who works in that domain.

### What a Subject Tutor does

**Perfects edges in its domain:**
When the Explorer finds a path through quantum field theory, it may be using edges of confidence
`t` or `u` — good but not verified. The Subject Tutor for QFT can audit those edges, verify the
relationships against the canonical texts, and either promote them to confidence `z` or flag them
as needing better sources.

**Answers "how do I get from here to there" in known territory:**
When a MiniMe or Explorer enters a Subject Tutor's domain, it can ask: "I'm at node A (a concept
the user knows) and I want to reach node B (something they want to understand). What's the minimal
path through known QFT/QM/topology/etc.?" The Subject Tutor returns the shortest verified path —
not a traversal, but a map lookup. This is pre-computed territory.

**Acts as a tutor interface:**
Users can talk directly to a Subject Tutor. "Teach me quantum electrodynamics from scratch."
The tutor knows the canonical learning path: the minimal set of concepts in the right order.
It presents them as a structured path through its verified subgraph, with each step linked to
the reader. The user can click into any step and go deeper, or ask "why do I need this?" and
the tutor explains the inferential dependency.

This is not the same as asking a general LLM. The Subject Tutor's responses are constrained to
its verified subgraph. It can't fabricate a theorem — it can only cite nodes that exist. The
tutor is as hallucination-proof as the grounding gate makes the regular chat, but structurally
so: it doesn't generate physics, it maps paths through verified physics.

### The shape of a subject

Each subject has a **canonical topology** that the Subject Tutor maintains:

- **Foundation nodes**: things everything else depends on (high in-degree).
- **Frontier nodes**: things that depend on many predecessors but have few successors — the edge
  of known territory.
- **Bridge nodes**: things that connect two otherwise separate subfields.
- **Gap nodes**: important results where the library has the statement but not the proof — the
  Subject Tutor flags these explicitly.

This topology is visualizable. The subject map has a shape. The shape reflects the structure of
the mathematics itself — which ideas are foundational, which are derivative, which bridge domains.
When a user visits a subject page, they can see this map and navigate it spatially.

### Subject Tutor as community infrastructure

Subject Tutors are not per-user. They're shared. Every user working in QFT uses the same QFT
Subject Tutor. This means:
- Verified edges contributed by any user in the community improve the tutor for everyone.
- The tutor's canonical subgraph grows as more verified paths accumulate across the community.
- A user who finds a shorter path through the subject can contribute it back — the tutor audits
  it, and if it's correct, integrates it.

This is the closest thing to collaborative knowledge building in the system: not social media,
not discussion threads, but shared improvement of the verified edge graph.

---

## Archetype 3: The Explorer

### Recap from prior sessions (brief)

Already designed in depth. The Explorer is the traversal agent: it follows edges, builds paths,
stores vibes, accumulates circumstantial evidence. It can run autonomously without a user question
as seed — it seeds from graph anomalies (high-connectivity nodes, high-similarity pairs with no
edge, dead-end clusters). It operates at the object level of the knowledge graph.

### New detail: Explorer × Subject Tutor interaction

When the Explorer is traversing and enters a well-mapped domain, it should detect this and switch
modes: instead of continuing its own graph traversal, it hands the question to the Subject Tutor.
"I've reached QFT territory. The tutor has this fully mapped. Let me ask it for the path rather
than re-traversing known ground."

This is the difference between exploring a jungle and reading a map of a city. The Explorer knows
the difference and acts accordingly.

---

## Archetype 4: The Philosopher

### Recap from prior sessions (brief)

Already designed. The Philosopher operates above the Explorer — it reads the Explorer's accumulated
workspace (dead ends, promoted vibes, confidence evolution) and generates conjectures. It notices
patterns across traversals, identifies consistent barriers, surfaces things that keep accumulating
circumstantial evidence without resolving.

### New detail: Two modes

**Trend-aware mode**: Has access to recent arXiv ingestion, can see what the community is working
on. Useful for grounding its conjectures in the current state of the field.

**Isolationist mode**: No external signal. Only the internal structure of the knowledge graph.
Follows the mathematics itself rather than the sociology of the field. This is the mode most
likely to find connections that human researchers missed because of shared cultural priors.
It has no priors except the graph. It may spend time on things humans already know — but
those things will be in the graph as edges, so it finds them quickly. The interesting discoveries
are the short paths through unexpected territory that no human thought to walk.

---

## The Hierarchy in Action — A Concrete Example

**Scenario**: Jony's MiniMe notices (from his chat history) that he keeps getting stuck on the
same barrier: connections between his amplitude theory notes and the BCFW shift literature.

**Step 1**: MiniMe surfaces this to Jony: "You've hit this barrier 7 times across 4 sessions.
Want me to investigate?"

**Step 2**: MiniMe invokes the Explorer with the specific barrier as seed.

**Step 3**: Explorer traverses outward from the barrier nodes. It hits the BCFW region and detects
that the Subject Tutor for scattering amplitudes has a verified subgraph here.

**Step 4**: Explorer consults the Subject Tutor: "I'm looking for a path from BCFW shifts to
the D-subset structure. What does the canonical map show?"

**Step 5**: Subject Tutor returns a 3-step verified path that exists in the canonical subgraph
but wasn't in Jony's personal library yet. It flags the entry-point concept Jony needs to add
to his library.

**Step 6**: Explorer returns this to the MiniMe with the path and the gap identified.

**Step 7**: MiniMe surfaces it to Jony: "The Subject Tutor for scattering amplitudes has a
path through this barrier. You're missing one concept in your library — here it is. This paper
covers it (linked). Once you have it, the path is 3 steps."

**Step 8 (background)**: The Philosopher, observing this exchange, notes that the BCFW–D-subset
connection has been a recurring barrier across multiple users' MiniMes. It adds this to its
active vibe list: "Many users independently converging on this connection. Possible structural
significance. Worth deeper investigation."

---

## What Needs to Be Built (beyond Phase A-D)

### For MiniMe:
- User reading/note/chat history aggregation into a persistent profile (Phase B TraversalSession
  is the seed of this — extend it to span sessions)
- MiniMe system prompt builder: takes user profile, produces a personalized agent context
- Public workspace UI: a user page showing public collections + MiniMe chat interface
- Clear epistemic labeling in UI: "This is a research agent, not the person"

### For Subject Tutor:
- Subject taxonomy: a canonical list of subjects and their containment hierarchy
  (Mathematics → Algebra → Abstract Algebra → Group Theory)
- Canonical subgraph seeding: process the core texts of each subject to build the verified core
- Subject page UI: the topology map (visualizable — nodes arranged by inferential distance,
  color-coded by confidence, bridges highlighted)
- Cross-user contribution system: verified paths can be contributed back to the shared subgraph

### For the full hierarchy:
- Agent-to-agent communication protocol: how a MiniMe invokes an Explorer, how an Explorer
  queries a Subject Tutor, how the Philosopher receives Explorer output
- Mode detection in Explorer: recognize when it's in well-mapped vs unmapped territory
- Philosopher scheduler: periodic wakeup without user trigger, reads accumulated Explorer
  output, generates conjecture documents stored in the philosopher workspace

---

## On the UI — It Doesn't Need to Change Much

The current books/collections UI (see screenshot) is close to right. The additions needed are:

1. **Subject pages**: like collection pages but not user-owned — shared infrastructure. A "QED"
   subject page shows the canonical subgraph map and links to the Subject Tutor chat.

2. **User profile pages**: public collections + brief about + MiniMe chat. Minimal. The MiniMe
   IS the profile — there's nothing else to say about a researcher that matters more than how
   they think.

3. **Workspace visibility controls**: a collection can be public (visible to other users, MiniMe
   can discuss it), private (only the user), or contributed (edges verified here feed the Subject
   Tutor for that domain).

The social layer is not social media. It's not posts, likes, or followers. It's:
- Can I talk to your MiniMe?
- Can I see which subject areas you've explored?
- Did you contribute edges to the shared canonical graph?

That's all. The depth is in the graph, not the interface.

---

## The Jobs Quote and What It Actually Means

Jobs said he'd like to have Aristotle as a tutor — someone who knew everything Aristotle knew
and could converse with you. The key insight is that this doesn't require the person to be alive.
It requires their *reasoning* to be preserved in a navigable form.

Newton's Principia is in a form we can traverse. His notebooks are in a form we can ingest.
If we build a MiniMe for Newton's collected works, we can ask it a question about mechanics and
get a response shaped by Newton's actual reasoning — not ChatGPT's generic response, but a
traversal through Newton's own nodes and edges, framed in the vocabulary Newton used.

The MiniMe is the Gyde answer to Jobs' dream. Not a simulation of a person — a navigation agent
over their knowledge graph. The distinction matters philosophically: it doesn't claim to replicate
the person. It claims to navigate how they reasoned about their domain.

That's honest and it's achievable. And it's something no social platform or AI assistant has
built — because they all prioritize content generation over knowledge structure.

---

*End of document. For implementation order, see gyde-agent-tech-spec.md (Phases A-D). The four
archetypes described here are the Phase E-H horizon — each one builds on the traversal
infrastructure that Phases A-D establish.*