# Cross-Cutting Engineering Patterns

The patterns documented here appear across every system in this portfolio. Each one represents a deliberate design decision that has cost me time when I skipped it and saved me time when I applied it consistently.

This document exists because a portfolio of 8 systems is interesting; a set of consistently-applied patterns across those 8 systems demonstrates engineering discipline.

---

## 1. AI for Language, Code for Math

**Where it appears:** Every project. Most explicitly in `document-automation-system` and `clinic-booking-system`.

**The rule:** Language models handle natural language understanding, text generation, and pattern recognition. Deterministic code handles arithmetic, time calculations, conflict detection, and any logic where the answer must be exact.

**Why this matters:**
- LLMs hallucinate numbers, especially when chained or required to perform multi-step arithmetic
- In healthcare booking, one wrong time = missed appointment
- In construction calculations, one wrong percentage = real money lost
- In CRM operations, one wrong status update = client confusion

**Implementation pattern:**

```
User message → AI extracts structured data → Code validates and computes → Code-driven actions
                                            ↑
                                  This boundary is sacred.
                                  AI never crosses into code's territory.
```

**Real examples in this portfolio:**
- `clinic-booking-system/code_examples.md` Section 4: AI extracts "preferred time," code computes actual available slots from Google Calendar
- `document-automation-system/code_examples.md` Section 3: AI extracts "reuse 40%, dispose 30%," code multiplies by quantity
- `lead-generation-system/code_examples.md` Section 2: AI personalizes the email, code handles deduplication and verification

---

## 2. Schema Normalization at the Edge

**Where it appears:** All multi-channel projects (`clinic-booking-system`, `gym-lead-management`, `beauty-center-reception-workflow`).

**The rule:** Different sources have different payload structures. Convert everything to one unified schema in the FIRST node after the webhook, before any downstream logic runs.

**Why this matters:**
- WhatsApp, Instagram, Messenger, and Telegram all use completely different JSON structures
- Without normalization, every downstream node must understand every source format
- One change in any source format breaks every node that touches it
- With normalization, only ONE file changes when a source updates

**Implementation pattern:**

```javascript
// 4 different channel detection branches
// → 1 unified schema
{
  channel: string,
  user_id: string,
  user_name: string | null,
  message_text: string,
  message_id: string,
  timestamp: ISO8601,
}
```

**Trade-off accepted:** One extra processing step. Worth it for maintainability.

---

## 3. Error Triggers on Every Critical Node

**Where it appears:** All projects. Connected as `errorWorkflow` in workflow settings.

**The rule:** A failure in any node sends a sanitized alert within 30 seconds. Silent failures are the #1 cause of broken production automation.

**Why this matters:**
- API rate limits happen at 3 AM
- A vendor changes their response format with no notice
- A WhatsApp account gets disconnected
- Without monitoring: leads stop coming, nobody notices for 10 days, client asks "why are we getting fewer leads?"

**Implementation pattern:**

1. Error Trigger node catches any failure in any workflow
2. Sanitizer scrubs API keys, tokens, PII before logging
3. Severity classifier (high/medium/low) based on error patterns
4. Slack alert with structured context (workflow, node, error, execution ID)
5. Errors sheet for historical analysis

**Real example:** `clinic-booking-system/code_examples.md` Section 5.

---

## 4. Human-in-the-Loop Where It Matters

**Where it appears:** `lead-generation-system` (mandatory), `marketing-lead-engine` (mandatory), `document-automation-system` (conditional on quality score).

**The rule:** When the cost of an AI mistake is high — outbound email, public publication, document delivery — a human approves before the action executes.

**Why this matters:**
- AI personalization at scale can send embarrassing emails to 100 prospects in seconds
- Content marketing can republish without permission and create legal/ethical issues
- Document processing can produce wrong calculations that get distributed before review

**Implementation patterns:**
- **Hard gates** (`lead-generation-system`): No outbound without explicit Telegram approval
- **Quality gates** (`document-automation-system`): Below 70% quality score routes to human review
- **Permission gates** (`marketing-lead-engine`): No publication without original author's explicit "yes"

**Trade-off accepted:** Lower throughput. Higher reliability and trust.

---

## 5. Idempotency for Webhook Reliability

**Where it appears:** `holistic-wellness-club` (most explicitly), all webhook-driven workflows.

**The rule:** Every event is processed exactly once, even if the source sends it 5 times.

**Why this matters:**
- GoHighLevel retries webhooks on any HTTP error
- Meta retries webhooks on connection issues
- Without idempotency: duplicate Sheet rows, duplicate reminders, duplicate calculations

**Implementation pattern:**

```javascript
// Two-layer dedup
1. Check by event_id (primary)
2. Check by (contact_id + event_type + timestamp_within_5s) (secondary)

If duplicate → log as 'duplicate_skipped' → exit gracefully
```

**Real example:** `holistic-wellness-club/code_examples.md` Section 2.

---

## 6. Sanitized Logging

**Where it appears:** Every project's error handler, every Slack alert, every external log.

**The rule:** No API key, token, password, or PII ever appears in any log or alert. Sanitization is built into the error handler, not optional.

**Why this matters:**
- One leaked API key can cost thousands in unauthorized API usage
- One leaked PII string can be a compliance violation
- Logs get screenshot, forwarded, archived — they live longer than you think

**Implementation pattern:**

```javascript
function sanitize(obj) {
  const sensitive = ['api_key', 'authorization', 'password', 'token', 'secret'];
  // Recursively replace any matching field with [REDACTED]
}
```

**Real example:** `clinic-booking-system/code_examples.md` Section 5.

---

## 7. Documentation as Deliverable

**Where it appears:** Every project has README + architecture.md + code_examples.md + workflow.json.

**The rule:** If a non-technical operator can't understand what the system does without me explaining it, the project isn't finished. Documentation is part of the deliverable, not an afterthought.

**Why this matters:**
- Clients churn when systems become opaque
- Handoffs fail when documentation is thin
- Future-you forgets what current-you built within 3 months

**What "good enough" looks like:**
- README explains the system in plain language
- Setup guide tells a new operator how to deploy it
- Architecture document explains design decisions and trade-offs
- Code examples show real patterns, not just placeholders

---

## 8. Defensive Programming at System Boundaries

**Where it appears:** Every webhook entry point, every external API call, every user input.

**The rule:** Validate inputs at the boundary. Retry transient failures. Time out long-running calls. Fail gracefully, not silently.

**Why this matters:**
- A malformed webhook payload should not crash the workflow
- An OpenAI rate limit should trigger backoff, not an unhandled error
- A slow Calendar API should not block message replies forever

**Implementation patterns:**
- Input validation in the first node after every webhook
- `retry: { maxRetries: 3, waitBetweenRetries: 2000 }` on every HTTP node calling an external API
- `timeout: 10000` (or appropriate) on every long-running call
- Fallback paths when primary providers fail (Claude fails → try OpenAI)

---

## Why These Patterns Matter

Anyone can connect n8n nodes to make a workflow execute once. These patterns are what make a workflow execute 1,000 times in a row without breaking, without leaking data, without losing customers, and without waking the operator up at 3 AM.

Every project in this portfolio applies these patterns. The patterns are why I can confidently say my systems "run in production" rather than "demo successfully."

If you're hiring an automation engineer, the question to ask isn't "can you build an AI receptionist?" It's "can you build one that doesn't break when WhatsApp changes their API at midnight?"

These patterns are how I answer yes.
