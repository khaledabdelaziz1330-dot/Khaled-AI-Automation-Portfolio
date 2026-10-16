# Brand-Voice AI Agent for X — Climate-Tech Company

**An AI agent that represents a climate-tech company on X** — it finds conversations about urban heat, climate and energy where the company's expertise adds value, judges each with an LLM, and replies to the best ones in the company's expert voice. Ran in production on a daily schedule, within strict brand-safety guardrails.

**Stack:** n8n · AWS Bedrock (LLM) · Apify · Google Sheets · JavaScript
**Architecture:** One n8n workflow with two independently scheduled pipelines (Scraper + Commenter) linked by a shared Google Sheets queue, plus a separate error-alert workflow
**Status:** In production for a climate-tech company — daily schedule, brand-safety guardrails

![X engagement workflow](./x-engagement-workflow.jpg)

---

## The problem

Consistent, high-quality engagement on X takes hours of skilled work every day: finding relevant conversations, filtering out noise, writing replies with genuine expertise, and keeping a steady, measured cadence. Discovering, vetting, writing, and pacing each quality reply takes ~3–5 minutes — at 20–24 replies/day, that's **~1–2 hours of skilled daily work**. This agent does all of it within the company's guardrails.

## The system

### Pipeline 1 — Scraper (daily, 09:00)

1. **Two discovery branches run in parallel:**
   - *Following branch:* pulls the brand's following list (Apify), converts each handle into a `from:handle` query, fetches recent tweets, and keeps each account's newest original post.
   - *Keyword branch:* assembles ~20 topic search phrases, searches X (Apify), then dedupes and applies min-likes + recency filters.
2. **Merge → dedup memory:** both branches merge, and every candidate is checked against a Google Sheet of already-processed tweet IDs, so each tweet is queued at most once.
3. **Three-layer relevance filtering:**
   - *Cheap pre-filters:* drop short/low-substance posts, enforce engagement floor + recency window, flag keyword hits.
   - *LLM classification (main gate):* AWS Bedrock applies a 3-part test (**Topic / Substance / Fit**), explicitly refuses memes, venting, and tragedy posts, and returns structured JSON `{ relevant, reason, angle }`.
   - *Fail-safe:* malformed or empty AI responses default to **not relevant** — the system fails closed rather than noisy.
4. **Queue writing:** winners are appended to the Google Sheets queue as `needs_comment`.

### Pipeline 2 — Commenter (hourly)

1. **Active-hours gate (09:00–21:00)** + random start jitter (0–5 min), so runs do not fire on the exact hour.
2. **Selection engine:** picks the batch under all caps simultaneously — highest-engagement first.
3. **Drafting:** AWS Bedrock writes the reply using the classifier's suggested angle, in the brand's practitioner voice.
4. **Quality + similarity gate:** length checks, refusal/boilerplate detection, and a **Jaccard word-overlap check (threshold 0.7)** against recent replies, so near-duplicates are not posted.
5. **Locked posting:** row is marked `posting` *before* the API call (dedup lock), the reply is posted via an Apify actor, then marked `posted` with the reply URL and timestamp.
6. **Failure path:** failed or skipped rows retry up to 3× then park as terminal `failed`, so a row cannot loop indefinitely or post twice.
7. **Random 3–12 minute gap** between replies.

## Engineering highlights

- **Structured-output LLM gating** — the classifier returns strict JSON with a fail-closed parser; a single bad response cannot halt or pollute a batch
- **Multi-layer duplicate protection** — sheet-level dedup memory, in-batch dedup, a pre-post row lock, posted-row exclusion, and API auto-retry deliberately OFF (the most common cause of accidental duplicates)
- **Volume governance** — hard caps of 24 replies/day, 2 per hourly run, 1 per author/day, inside a 12-hour active window with randomized pacing
- **One LLM backend, two jobs** — AWS Bedrock powers both relevance classification and reply drafting, with separate structured prompts
- **Zero-infrastructure queue** — Google Sheets serves as queue, status tracker, and dedup memory; no external database needed
- **Dedicated error-alert workflow** — failures email the team as they happen

## Observed performance

| Metric | Value |
|---|---|
| Candidates reaching the classifier per daily run | ~50–100 (observed runs: 78 and 85) |
| Kept as relevant by the classifier | ~35–55% (observed run: 42 of 85) |
| New relevant posts queued daily | ~15–40 |
| Replies posted | up to 24/day, max 1 per author |
| Expert work handled | **~1–2 hours per day** (20–24 replies × 3–5 min) |

---

*The workflow JSON export is not published in this repository (client confidentiality); it is available on request for technical review.*
