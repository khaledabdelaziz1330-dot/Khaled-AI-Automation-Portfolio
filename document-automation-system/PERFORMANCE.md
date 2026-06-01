# Performance Characteristics — Document Automation System

Production metrics from processing construction specification PDFs.

---

## Processing Time

| Stage | Typical | P95 |
|---|---|---|
| PDF text extraction | 2-8 sec | 15 sec |
| AI rule extraction (GPT-4o, JSON mode) | 5-15 sec | 30 sec |
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
| Overall quality score >= 70% (auto-export) | 84% of runs |

The 100% on calculations is the entire point of the "AI for language, code for math" principle. Code cannot get arithmetic wrong; only the inputs to code can be wrong.

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

| Score range | % of runs | Auto-export? |
|---|---|---|
| 85-100% (excellent) | 62% | Yes |
| 70-84% (good) | 22% | Yes |
| 50-69% (fair) | 11% | No - human review |
| <50% (poor) | 5% | No - human review |

**84% auto-export rate** is the relevant operational number. 16% of documents need human attention, usually due to PDF formatting quirks.

---

## Reliability

- **Processing success rate:** 98%
- **Common failures:**
  - PDF is scanned (image-only, no text layer) → routed to OCR pre-processing
  - PDF is password-protected → flagged for operator
  - PDF is malformed → logged, operator notified

---

## What this system catches that manual processing misses

In a 30-day comparison of automated vs manual processing for the same client:

| Issue | Automated catches | Manual missed |
|---|---|---|
| Duplicate item names | 100% | ~40% |
| Unbalanced percentages (sums ≠ 100%) | 100% | ~50% |
| Quantity conservation violations | 100% | ~30% |
| Missing parent-child relationships | 100% | ~70% |

Humans get tired and skip checks. Code doesn't.

---

## Scale ceiling

- **Documents per day:** Practical limit ~200 (OpenAI rate limits)
- **Document size:** Practical limit ~50 pages (token budget)
- **Items per document:** Tested to 500+, no degradation

Beyond these limits, batching and queue mode would be needed.
