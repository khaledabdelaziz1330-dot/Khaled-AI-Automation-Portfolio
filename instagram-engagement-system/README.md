# Autonomous Instagram Engagement Agent

**Fully automated Instagram engagement lifecycle** — discovers fresh, on-brand posts from the accounts a climate-tech brand follows, filters them with an LLM, writes expert comments in the brand's voice, and posts them via a managed API — with pacing, capping, quality-gating, duplicate protection, and self-healing failure recovery built in.

**Stack:** n8n · AWS Bedrock (LLM) · Apify · Unipile API · Google Sheets · JavaScript
**Architecture:** Two linked workflows (Scraper + Commenter) sharing one Google Sheet

![Instagram engagement workflow](./instagram-engagement-workflow.jpg)

---

## The problem

Meaningful Instagram engagement — finding the right posts from your network, commenting with genuine insight, and doing it consistently every day — is slow, repetitive, skilled work. This system automates the entire lifecycle while keeping the brand account's automated footprint to the bare minimum: **all scraping runs off-account on Apify's infrastructure**; the account itself performs only the single low-volume action that matters — posting the comment.

## The system

### Workflow 1 — Scraper (every 6 hours)

1. **Following list** pulled via Apify actor (off-account).
2. **Username hygiene:** private accounts removed, exclusion list applied, deduped, then **shuffled and capped per run** — so coverage rotates across the whole following list over successive runs.
3. **Latest posts** fetched per account (Apify), with pinned-post and stale-post drops *re-enforced in code* — the workflow never trusts the scraper's own filters.
4. **`media_id` capture** — the numeric ID the posting API requires (not the shortcode); mapped alongside caption, likes, author, and timestamps.
5. **Dedup gate:** any post already in the sheet (any status) is dropped — a post can never be queued or commented twice, across any number of runs.
6. **LLM relevance filter:** AWS Bedrock judges each post against the brand's domain (urban heat, climate resilience, infrastructure), instructed to be strict and skip borderline cases; returns JSON `{ relevant, angle }` with retries and continue-on-error so one bad response never halts a batch.
7. Relevant posts are appended to the queue as `needs_comment`.

### Workflow 2 — Commenter (hourly, 09:00–21:00)

1. **Active-hours gate + random start jitter** — activity only in human hours, never on the exact hour.
2. **Selection engine enforces every rule at once:** daily budget, per-run cap, one-comment-per-author-per-day, stale-queue guard, freshest-first ordering — and **reclaims orphaned rows** (stuck mid-post after a restart) via a lock-timestamp window, so nothing is ever silently lost.
3. **Drafting:** Bedrock writes a <220-character comment in the brand's practitioner voice — reacting to a specific detail of the caption, adding one genuine insight; no hashtags, links, mentions, emojis, or pitching.
4. **Shape & quality gate:** strips artifacts, enforces length at sentence boundaries, rejects empty/refusal/boilerplate drafts, and blocks near-duplicates via similarity check against recent comments.
5. **Locked posting via Unipile:** the row is marked `posting` (with timestamp) *before* the API call; the comment posts through Unipile's managed session API — chosen over fragile cookie automation because it handles session reconnection and security checkpoints.
6. **Response verification:** success only on HTTP 201 / `CommentSent` — a successful post can never be misread as failed (which would cause a duplicate on retry). API auto-retry is deliberately OFF.
7. **Failure path:** attempts increment; below the cap the row re-queues, after 3 attempts it parks as terminal `failed`. Disconnected-account errors are detected and held for reconnection.
8. **Random 3–12 minute gap** between comments.

## Row lifecycle (the state machine)

| Status | Set by | Meaning |
|---|---|---|
| `needs_comment` | Scraper / retry path | Relevant post awaiting a comment |
| `posting` | Commenter | Draft ready, post in flight — acts as a dedup lock |
| `posted` | Commenter | Published; permanently excluded from selection |
| `failed` | Commenter | Terminal after 3 attempts; left for human review |

## Engineering highlights

- **Off-account scraping architecture** — the brand account's automated surface area is minimized to a single API action
- **Five-layer duplicate protection** — queue-level dedup, pre-post row lock, posted-row exclusion, no auto-retry, similarity check on wording
- **Self-healing queue** — orphaned `posting` rows (from crashes/restarts) auto-reclaim after a timeout; in-flight rows are never touched
- **Conservative volume governance** — 12 comments/day, 1 per run, 1 per author/day, active hours only, randomized gaps, with gradual ramp-up guidance for new accounts
- **Managed-session posting** (Unipile) instead of brittle cookie automation — verified against real API responses
- **Structured, fail-closed LLM gating** at both the relevance and drafting stages

---

*Workflow JSON exports available for technical review.*
