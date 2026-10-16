# Performance Characteristics — Hostzera AI Chat Widget

Production metrics from the retrieval-grounded chat widget running on hostzera.com.

---

## Response Time

| Stage | Typical | P95 |
|---|---|---|
| Widget POST → response delivered | 1.5 sec | 3.0 sec |
| Request validation | 30 ms | 80 ms |
| KB read (Google Sheets) | 250 ms | 700 ms |
| History lookup | 200 ms | 600 ms |
| KB keyword scoring (in-memory) | 15 ms | 30 ms |
| Claude response generation | 800 ms | 2,000 ms |
| Link enrichment post-processing | 10 ms | 25 ms |
| Conversation logging | 200 ms | 500 ms |

**User-facing target:** Under 3 seconds end-to-end. Met 95% of the time.

---

## Throughput

- **Sustained:** 30 concurrent active chat sessions
- **Daily volume:** Typical day: 80-300 conversations
- **Peak observed:** 450 conversations in a single day (post-product-launch traffic)

Bottlenecks:
1. Claude API latency, the largest single stage (bounded by `max_tokens: 800` and a top-5 retrieved context)
2. Google Sheets read latency at peak (KB read reaches 700 ms and history lookup 600 ms at P95)

---

## Cost per Conversation

Average 5-7 turn conversation:

| Component | Cost |
|---|---|
| Anthropic Claude (Sonnet, ~1500 tokens avg) | $0.018 |
| Google Sheets reads | $0 (free tier) |
| n8n compute | $0.0002 |
| **Total per conversation** | **~$0.018** |

**Monthly cost for typical traffic** (~150 conversations/day): ~$82/month.

---

## Hallucination Rate

This is the metric that matters most for a retrieval-grounded system.

Sample audit (200 conversations randomly selected over 30 days):

| Outcome | Count | Percentage |
|---|---|---|
| Answer correctly grounded in KB | 184 | 92% |
| AI correctly said "let me connect you with our team" | 13 | 6.5% |
| AI provided slightly stale info (KB row was outdated) | 2 | 1% |
| **Genuine hallucination (made-up price/feature)** | **1** | **0.5%** |

The single hallucination was investigated: the model inferred a discount from context that was not actually offered. The prompt was tightened, and a subsequent 100-conversation audit showed 0 hallucinations.

**For context:** hallucination rates of 8-15% are commonly cited for general-purpose support bots without retrieval grounding. That range is an external benchmark, not a controlled comparison run on this system.

---

## Reliability (90-day window)

- **Uptime:** 99.6%
- **Claude API failures:** 0.3% of calls (the HTTP node retries up to 3 attempts, 2 s apart)
- **Google Sheets failures:** 0.1% (surfaced to the shared error handler)
- **Total customer-visible errors:** <0.1%

---

## Outcome Metrics

| Metric | Result |
|---|---|
| Avg satisfaction rating (post-chat survey) | 4.3/5 |
| % conversations leading to support ticket creation | 12% (down from 35% baseline) |
| % conversations leading to product page view | 28% |
| Avg conversation length | 5.2 turns |
| % sessions ending with "connect me with human" | 6.5% |

The "connect me with human" rate is intentionally non-zero: a clean escalation is better than false confidence.

---

## Multi-Language Performance

Distribution across 30 days:

| Language | Conversations | Avg satisfaction |
|---|---|---|
| English | 68% | 4.4/5 |
| Arabic | 24% | 4.2/5 |
| Russian | 5% | 4.1/5 |
| Other | 3% | N/A (low sample) |

Arabic satisfaction is slightly lower because the model defaults to Modern Standard Arabic, which can read as formal. Prompt iteration toward a more conversational register is ongoing.

---

## Where this would NOT scale gracefully

- **>500 active concurrent sessions:** Google Sheets KB lookup becomes the bottleneck. Move the KB behind a Redis or in-memory cache.
- **KB >500 products:** Keyword scoring loses precision. Move to embedding-based retrieval.
- **>10,000 messages/day:** Requires n8n queue mode, batched logging, and possibly dedicated infrastructure per language.

The current design is sized for Hostzera's actual traffic; 10x scale would require the changes above.
