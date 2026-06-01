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

**User-facing target:** Under 3 seconds for streaming-equivalent UX. Met 95% of the time.

---

## Throughput

- **Sustained:** 30 concurrent active chat sessions
- **Daily volume:** Typical day: 80-300 conversations
- **Peak observed:** 450 conversations in a single day (post-product-launch traffic)

Bottlenecks:
1. Claude API throughput (mitigated by token batching, model selection)
2. Sheet read latency at peak (mitigated by 30-second in-memory KB cache)

---

## Cost per Conversation

Average 5-7 turn conversation:

| Component | Cost |
|---|---|
| Anthropic Claude (Sonnet, ~1500 tokens avg) | $0.018 |
| OpenAI fallback (when Claude fails) | $0.005 (rare) |
| Google Sheets reads | $0 (free tier) |
| n8n compute | $0.0002 |
| **Total per conversation** | **~$0.019** |

**Monthly cost for typical traffic** (~150 conversations/day): ~$85/month.

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

The single hallucination was investigated: AI inferred a discount from context that wasn't actually offered. Prompt was tightened. Subsequent 100-conversation audit showed 0 hallucinations.

**Compare to non-retrieval-grounded chatbots:** Industry hallucination rates for general support bots run 8-15%.

---

## Reliability (90-day window)

- **Uptime:** 99.6%
- **Claude API failures:** 0.3% (auto-fallback to OpenAI, no user impact)
- **Google Sheets failures:** 0.1% (rare, cached fallback)
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

The "connect me with human" rate is intentionally non-zero — better to escalate cleanly than fake confidence.

---

## Multi-Language Performance

Distribution across 30 days:

| Language | Conversations | Avg satisfaction |
|---|---|---|
| English | 68% | 4.4/5 |
| Arabic | 24% | 4.2/5 |
| Russian | 5% | 4.1/5 |
| Other | 3% | N/A (low sample) |

Arabic satisfaction is slightly lower because the AI defaults to Modern Standard Arabic, which can feel formal. Iteration on the prompt to encourage more conversational tone is ongoing.

---

## Where this would NOT scale gracefully

- **>500 active concurrent sessions:** Google Sheets KB lookup becomes a real bottleneck. Migrate to a Redis or in-memory cache.
- **KB >500 products:** Keyword scoring loses precision. Move to vector embedding-based retrieval.
- **>10,000 messages/day:** Need queue mode in n8n, batched logging, possibly dedicated infrastructure per language.

These are real limits I've reasoned through. The current implementation is appropriate for Hostzera's actual traffic patterns; it would need significant rework for 10x scale.
