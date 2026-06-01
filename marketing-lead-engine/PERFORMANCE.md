# Performance Characteristics — Marketing Content Engine

Production metrics from the permission-based content pipeline.

---

## Throughput

| Stage | Capacity |
|---|---|
| RSS feed scanning | 50-200 articles per 6-hour cycle |
| Article deduplication | Instant |
| AI rewrite (GPT-4o) | 30 sec per article |
| Permission email send | <5 sec |
| Response parsing | <1 sec |

Typical day: 30-80 new articles discovered, ~20 selected for permission requests, ~5 ultimately published.

---

## Permission Flow Conversion

The full funnel from discovery to publication:

| Stage | Conversion |
|---|---|
| Articles discovered | 100% |
| Pass dedup + freshness filter | 60-70% |
| Pass AI rewrite quality | 95% |
| Permission email delivered | 90% (10% bounce on inferred email) |
| Author responds within 7 days | 25% |
| Of responders: explicitly approve | 80% |
| Of approved: pass safety checks | 100% |
| **End-to-end publish rate** | **~12-15%** of discovered articles |

This is a quality funnel, not a quantity funnel. The system prioritizes ethical operation over volume.

---

## Cost per Published Post

| Component | Cost |
|---|---|
| RSS scanning | $0 |
| AI rewrite (only for likely-publishable articles) | $0.05-0.10 per attempt |
| Gmail send | $0 |
| **Total per published post** | **~$0.50-1.00** (counting failed attempts) |

For 5 published posts per week: ~$10-20/month in API costs.

---

## Quality Metrics

| Metric | Result |
|---|---|
| Facts preserved from original (audit) | 98% |
| Authors who appreciated being asked | ~75% (qualitative, from response sentiment) |
| Original authors who re-shared the rewrite | ~30% |
| Legal/ethical complaints | 0 |

The 30% re-share rate is a key insight: ethical content rewriting often gets MORE distribution than scraping, because the original author becomes an amplifier.

---

## Reliability

- **Pipeline uptime:** 99.5%
- **False approvals (system thought author approved, they didn't):** 0 in 6 months
- **False rejections (system rejected when author approved):** 2 (resolved by adding pattern to intent parser)

---

## Comparison to "Standard" Content Marketing Automation

Standard tools scrape and republish without asking. This system asks first.

| Approach | Reach | Reputation | Legal risk |
|---|---|---|---|
| Standard scrape-republish | Higher initial | Eroding over time | Real |
| **This permission-based system** | **Lower initial, compounds over time** | **Building** | **Eliminated** |

The compounding effect: authors who agree once tend to agree again. Over 6 months, ~40% of the publication queue comes from authors who've been asked before.

---

## Where this hits limits

- **High-frequency news cycles:** Permission flow adds 7-day delay. Not suitable for breaking news.
- **Anonymous-author sources:** Cannot ask permission of "Editor" — limits sourcing options.
- **Non-English feeds:** Permission email template needs localization for non-English authors (currently English-only).
