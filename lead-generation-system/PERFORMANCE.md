# Performance Characteristics — Lead Generation Engine

Production metrics from running cold outreach campaigns for marketing agencies.

---

## Throughput

| Stage | Capacity |
|---|---|
| Apify scraping | 100-200 leads per campaign run |
| Deduplication | 10,000+ leads/sec (in-memory) |
| ZeroBounce verification | 50-100 leads/min (API limit) |
| AI personalization | 60-120 leads/hour (rate-limited) |
| Human approval | Operator-dependent (typically 4-12 hour SLA) |
| Gmail send | 500 emails/day (Workspace limit) |

Typical campaign: **150 verified, personalized, human-approved leads per week per active campaign.**

---

## Cost Breakdown

Per verified lead going to send:

| Component | Cost |
|---|---|
| Apify scraping | $0.02-0.05 |
| ZeroBounce verification | $0.007 |
| OpenAI personalization (GPT-4o) | $0.01-0.02 |
| Gmail / Google Workspace | $0 (included) |
| n8n compute | $0.0005 |
| **Total per lead** | **~$0.04-0.08** |

For 150 leads/week = ~$6-12/week per campaign.

---

## Quality Metrics

Industry benchmarks vs this system:

| Metric | Industry avg | This system |
|---|---|---|
| Bounce rate | 15-25% | <2% (post-ZeroBounce filter) |
| Reply rate | 3-5% | 8-12% (depends on list quality) |
| Spam complaint rate | 0.5-2% | <0.1% (human approval gate) |
| Sender reputation impact | Often negative | Stable |
| Approval rate (AI-generated → operator approves) | N/A | ~75% (25% edited, 5% rejected) |

The single most important number above: bounce rate < 2%. This is the difference between burning a domain in 2 months vs running it for years.

---

## Reliability

- **Pipeline success rate (end-to-end):** 96%
- **Apify scraping failures:** 2% (handled with retry)
- **ZeroBounce timeouts:** 1% (retry with backoff)
- **OpenAI rate limits hit:** 5-10% (transparent retry, doesn't block pipeline)

---

## Outcome (per campaign, real numbers from agency clients)

| Metric | Result |
|---|---|
| Time from scrape to first reply | 24-48 hours |
| Cost per qualified reply | $0.50-1.50 |
| Cost per booked meeting | $5-15 |
| Operator time per 150 leads | ~2 hours (approval review) |

Compare to: a $4,000/month SDR at 20-30 dials/day = $5-10 per dial. This pipeline produces personalized outreach at fraction of the cost.

---

## What this pipeline deliberately does NOT do

- ❌ Does not scrape personal LinkedIn data
- ❌ Does not send without human approval
- ❌ Does not use clichéd opening lines
- ❌ Does not send follow-ups automatically (separate approval per follow-up)
- ❌ Does not chase unresponsive leads more than 2 attempts

These constraints lower throughput but protect deliverability and reputation. The pipeline is built for sustainable outreach, not spike-and-burn.
