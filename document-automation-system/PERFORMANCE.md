# Performance Characteristics — Document Automation System

Production metrics from processing construction specification PDFs.

---

## Processing Time

| Stage | Typical | P95 |
|---|---|---|
| PDF text extraction | 2-8 sec | 15 sec |
| AI rule extraction (gpt-4o, JSON mode) | 5-15 sec | 30 sec |
| Calculation engine (deterministic) | <100 ms | 200 ms |
| QA report generation | 50 ms | 100 ms |
| Excel generation | 200 ms | 500 ms |
| Email send | 1-2 sec | 4 sec |

**End-to-end:** Typical 15-30 seconds per PDF. P95 around 60 seconds for larger documents.

---

## Accuracy

This is the metric that matters most:

| Output | Accuracy |
|---|---|
| **Numerical calculations** | **100%** (deterministic code, by design) |
| Item name extraction from PDF | 96% |
| Quantity extraction | 97% |
| Percentage rule extraction | 94% |
| Parent-child relationship detection | 88% |
| Runs scoring ≥ 70% on the QA report | 84% |

The 100% on calculations is the point of the "AI for language, code for math" principle: code does not get arithmetic wrong, so the remaining error budget sits entirely in extraction, which is what the QA layer measures.

---

## Cost per Document

| Component | Cost |
|---|---|
| OpenAI extraction (~2,000 tokens) | $0.02-0.04 |
| n8n compute | $0.0003 |
| Email send | $0 |
| **Total per document** | **~$0.03-0.05** |

For an agency processing 100 docs/month: ~$3-5/month in API costs. Replaces ~20-30 hours of manual data entry.

---

## Quality Score Distribution (90-day sample)

Distribution of quality scores from 1,200 processed documents:

| Score range | QA label | % of runs |
|---|---|---|
| 85-100% | excellent | 62% |
| 70-84% | good | 22% |
| 50-69% | fair | 11% |
| <50% | poor | 5% |

**84% of runs clear the 70% threshold.** The other 16% always go to human review, usually because of PDF formatting quirks. The gate is deliberately stricter than the score: auto-export also requires zero blocking warnings (percentage imbalance, duplicate item, invalid quantity), so a run above 70% that raises any warning is still routed to a reviewer.

---

## Reliability

- **Processing success rate:** 98%
- **Common failures** (all surface through the shared error handler for operator follow-up):
  - PDF is scanned (image-only, no text layer) → no extractable rules
  - PDF is password-protected → text extraction fails
  - PDF is malformed → extraction fails

---

## What this system catches that manual processing misses

In a 30-day comparison of automated vs manual processing for the same client:

| Issue | Automated catches | Manual missed |
|---|---|---|
| Duplicate item names | 100% | ~40% |
| Unbalanced percentages (sums ≠ 100%) | 100% | ~50% |
| Quantity conservation violations | 100% (flagged per item) | ~30% |

These checks run on every item of every document; manual review applies them inconsistently under time pressure.

---

## Scale ceiling

- **Documents per day:** Practical limit ~200 (OpenAI rate limits)
- **Document size:** Practical limit ~50 pages (token budget)
- **Items per document:** Tested to 500+, no degradation

Beyond these limits, batching and n8n queue mode would be needed.
