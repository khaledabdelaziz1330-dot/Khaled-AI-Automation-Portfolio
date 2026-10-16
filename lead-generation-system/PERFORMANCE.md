# Performance Characteristics — Lead Generation Engine

Production metrics from running cold outreach campaigns for marketing agencies. Deliverability and reply metrics cover the full outreach loop, including the approval-handling and send steps that sit outside the exported [`workflow.json`](workflow.json).

---

## Throughput

| Stage | Capacity |
|---|---|
| Apify scraping | 100-200 leads per campaign run |
| Deduplication | 10,000+ leads/sec (in-memory) |
| ZeroBounce verification | 50-100 leads/min (API limit) |
| AI personalization | 60-120 leads/hour (rate-limited) |
| Human approval | Operator-dependent (typically 4-12 hour SLA) |
| Gmail send (downstream of approval) | 500 emails/day (Gmail sending limit) |

Typical campaign: **150 verified, personalized, human-approved leads per week per active campaign.**

---

## Cost Breakdown

Per verified lead going to send:

| Component | Cost |
|---|---|
| Apify scraping | $0.02-0.05 |
| ZeroBounce verification | $0.007 |
| OpenAI personalization (gpt-4o) | $0.01-0.02 |
| Gmail / Google Workspace | $0 (included) |
| n8n compute | $0.0005 |
| **Total per lead** | **~$0.04-0.08** |

For 150 leads/week = ~$6-12/week per campaign.

---

## Quality Metrics

Common cold-outreach benchmarks vs this system:

| Metric | Common benchmark | This system |
|---|---|---|
| Bounce rate | 15-25% (unverified lists) | <2% (post-ZeroBounce filter) |
| Reply rate | 3-5% | 8-12% (depends on list quality) |
| Spam complaint rate | 0.5-2% | <0.1% (human approval gate) |
| Sender reputation impact | Often negative | Stable |

Benchmarks are commonly cited industry ranges, not a controlled A/B test on this system.

The single most important number above: bounce rate < 2%. That is the difference between burning a domain in 2 months and running it for years.

### Operator decisions on AI drafts

| Decision | Share of drafts |
|---|---|
| Approved as written | ~75% |
| Approved after edits | ~20% |
| Rejected | ~5% |
| **Total** | **100%** |

~95% of drafts are ultimately approved, either as written or after operator edits.

---

## Reliability

- **Pipeline success rate (end-to-end):** 96%
- **Apify scraping failures:** 2% (surfaced to the shared error handler; the next weekly run re-scrapes, and deduplication prevents double entries)
- **ZeroBounce timeouts:** 1% (retried up to 4 attempts, 2 s apart)
- **OpenAI rate limits hit:** 5-10% of runs (the reason AI personalization is capped at 60-120 leads/hour)

---

## Outcome (per campaign, real numbers from agency clients)

| Metric | Result |
|---|---|
| Time from scrape to first reply | 24-48 hours |
| Cost per qualified reply | $0.50-1.50 |
| Cost per booked meeting | $5-15 |
| Operator time per 150 leads | ~2 hours (approval review) |

---

## What this pipeline deliberately does NOT do

- ❌ Does not scrape personal LinkedIn data (Google Maps business listings only)
- ❌ Does not send without human approval
- ❌ Does not use clichéd opening lines (banned in the prompt)
- ❌ Does not send automated follow-ups (each draft is a single first-touch email)

These constraints lower throughput but protect deliverability and reputation. The pipeline is built for sustainable outreach, not spike-and-burn.
