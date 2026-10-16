# RAG Sales & Support Assistant — Hostzera

AI customer support and sales assistant for a web hosting platform
(Website Chat Widget · Keyword Retrieval · Anthropic Claude · Multi-Language · Session History)

---

![hostzera chat widget workflow](chat-widget-workflow.png)

*Screenshot: the workflow as originally built in the n8n editor. The exported [`workflow.json`](workflow.json) is the sanitized reference version of this pipeline; its node names and structure differ, and this documentation describes `workflow.json`.*

---

## What This System Does

A retrieval-grounded support and sales assistant for **Hostzera**, a web hosting platform. Every visitor message is matched against a structured knowledge base in Google Sheets; only the top-scoring rows are passed to Anthropic Claude, which is instructed to answer from that context alone and to hand off to the team when the context does not cover the question. The reply is returned to the chat widget embedded on the website.

**Key features:**

- Chat widget on the Hostzera website, backed by an n8n webhook
- Structured knowledge base in Google Sheets (products, descriptions, prices, tags, URLs) that non-technical staff can edit
- Deterministic keyword retrieval in JavaScript: top 5 KB rows per message, exact product-name matches boosted
- Grounded generation: Claude answers only from retrieved context and escalates ("let me connect you with our team") when it cannot
- Language detection (English, Arabic, Russian, Chinese) with the reply language set in the prompt
- Session history: the last 10 turns are read from a Conversations sheet and included in the prompt
- Automatic linking of mentioned products to their pages
- Every inbound and outbound message logged with language, KB match count and token usage

---

## How It Works

1. **Visitor sends a message**
   The widget POSTs `message` and `session_id` to the n8n webhook. The request is validated (required fields, 1,000-character limit).

2. **Knowledge base and session history are loaded**
   Active KB rows and the session's prior turns are read from Google Sheets.

3. **Retrieval (JavaScript)**
   A Code node scores each KB row against the message tokens (longer token matches weigh more; exact product-name matches double the score) and keeps the top 5 as the only context the model sees.

4. **Language detection and history formatting**
   Unicode-range detection selects the reply language; the last 10 turns are formatted for the prompt.

5. **Grounded response from Claude**
   An HTTP Request node calls the Anthropic Messages API (`claude-3-5-sonnet-20241022`, temperature 0.3, max 800 tokens) with a system prompt that forbids inventing prices, plans or features.

6. **Post-processing, logging and reply**
   Product names from the retrieved rows are linked to their URLs, both sides of the turn are appended to the Conversations sheet, and the reply is returned to the widget with language and KB-match metadata.

---

## Workflow Architecture

```
Chat Widget Webhook (POST)
  → Validate Request
    ├── Get Knowledge Base (Sheets) → KB Retrieval & Scoring (top 5 rows)
    └── Get Session History (Sheets) → Detect Language & Format History
      → Claude Response (HTTP → Anthropic Messages API)
        → Enrich with Links
          ├── Log User Message (Sheets)
          ├── Log AI Response (Sheets)
          └── Return to Widget (Respond to Webhook)
```

Failures are routed to the portfolio's [shared error handler](../shared-error-handler) through the workflow's `errorWorkflow` setting.

---

## Stack

| Layer | Tools |
|---|---|
| **Orchestration** | n8n (self-hosted on VPS) |
| **AI Model** | Anthropic Claude (`claude-3-5-sonnet-20241022`, via HTTP Request to the Messages API) |
| **Knowledge Base** | Google Sheets (products, pricing, descriptions, URLs) |
| **Logic** | JavaScript (validation, retrieval scoring, language detection, link enrichment) |
| **Communication** | Webhook + Respond to Webhook (real-time widget integration) |
| **Memory** | Google Sheets Conversations log (last 10 turns per session) |

---

## Impact

Measured in production on hostzera.com (see [PERFORMANCE.md](PERFORMANCE.md)):

- **~0.5% hallucination rate** in a 200-conversation audit (1 case); 0 in a follow-up 100-conversation audit after the prompt was tightened
- **Support-ticket creation down from 35% to 12%** of conversations
- **~1.5 s typical / 3.0 s P95** end-to-end response time
- **~$0.018 per conversation** in model and compute cost
- **99.6% uptime** over 90 days; 4.3/5 average post-chat rating

---

## Notes

- The Hostzera team updates the knowledge base in Google Sheets without touching the automation
- Escalation is a prompt-level rule: when retrieved context does not cover a question, the assistant hands off to the team instead of guessing (6.5% of sessions)
- Grounding reduces hallucination; it does not eliminate it. The audit process in PERFORMANCE.md is how the residual rate is measured and driven down
- Keyword retrieval over Sheets is a deliberate fit for a ~50-product catalog; the scaling limits and migration path are documented in PERFORMANCE.md
