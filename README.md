# Khaled Abdelaziz — AI Engineer

**LLM Applications · AI Agents · Enterprise Workflow Automation**

[![tests](https://github.com/khaledabdelaziz1330-dot/Khaled-AI-Automation-Portfolio/actions/workflows/tests.yml/badge.svg)](https://github.com/khaledabdelaziz1330-dot/Khaled-AI-Automation-Portfolio/actions/workflows/tests.yml)

AI Engineer at **Quara Holding**, the Riyadh-headquartered group behind Saudi-listed **Dar Al Arkan**, London-listed **Dar Global** (US$23 billion development portfolio) and proptech platform **Wasalt**. I design, build and operate production AI systems — conversational agents, retrieval-grounded assistants, document intelligence and data pipelines — that deliver measurable business results.

This repository presents **ten AI systems** from my work for clients and employers before joining Quara — each with its architecture, measured results and a sanitized workflow export — together with the **shared error handler** they report to and an **automated test suite** that verifies the engineering claims on every push.

[LinkedIn](https://www.linkedin.com/in/khaledabdelaziz-ai) · [Email](mailto:khaledabdelaziz1330@gmail.com) · **Languages:** Arabic (native) · English (fluent)

---

## Current role — AI Engineer, Quara Holding (Jun 2026 – present)

A multinational real estate, finance and technology group operating in **13 countries**. This work is confidential and is not published here; the scope below matches my CV.

| | |
|---|---|
| **Production systems** | **7+ production AI agents and workflows** across Dar Al Arkan, Dar Global and Wasalt, adopted by the sales, marketing and multimedia teams |
| **Prospect intelligence** | Spearheading Dar Global's AI prospect-intelligence engine for international luxury sales — **5,000+ high-net-worth prospects** enriched, verified and AI-scored into the CRM |
| **Conversational AI** | Arabic/English AI agents that qualify leads and manage customer conversations across a branded-luxury portfolio in **9 countries** |
| **Integration** | CRM, paid-media, messaging and internal systems integrated for a **1,300+ broker** sales network — saving **30+ hours of manual work every week** |
| **AI enablement & governance** | Prompt libraries, no-code agent interfaces and dashboards, with monitoring for accuracy, reliability and cost |

The systems below apply the same engineering approach to work I can share publicly.

---

## Featured systems

Three AI agents — conversational, retrieval-grounded and brand-voice — and two AI pipelines, each with measured results.

### Healthcare AI Receptionist
**n8n · OpenAI (gpt-4o, gpt-4o-mini) · Google Calendar · Google Sheets · Meta Graph API · Telegram**

![Healthcare AI receptionist workflow](./clinic-booking-system/clinic%20workflow.jpg)

Answers patient inquiries and books appointments across WhatsApp, Instagram, Messenger and Telegram, in Arabic or English. A single webhook normalizes all four channels into one schema; a deterministic gpt-4o-mini classifier routes each message; gpt-4o extracts booking details as structured JSON; and **available slots are computed in code from the live Google Calendar, in the clinic's time zone** — the model never decides availability.

**Impact (90-day production window):** 90%+ of inquiries resolved without staff · replies in under 2 minutes · front-desk workload down 70% (35–40 → 10–12 hours a week) · no-shows down from 18% to 6%.

[README](./clinic-booking-system) · [Architecture](./clinic-booking-system/architecture.md) · [Performance](./clinic-booking-system/PERFORMANCE.md) · [KPI analytics (Python + SQL)](./clinic-booking-system/analytics) · [Setup guide](./clinic-booking-system/setup.md) · [Tests](./tests/clinic.test.js)

### RAG Sales & Support Assistant — Hostzera
**n8n · Anthropic Claude · Google Sheets · JavaScript**

![RAG sales and support assistant workflow](./hostzera-chat-widget/chat-widget-workflow.png)

Answers sales and support questions for a web-hosting company, grounded only in the company's own knowledge base. Each visitor message is scored against a staff-editable knowledge base; only the five best-matching entries reach Claude, which answers from that context alone and hands off to the team when it cannot. Retrieval and conversation history load in parallel and merge before a single model call.

**Impact:** ~0.5% hallucination rate, measured on a 200-conversation audit · support-ticket rate down from 35% to 12% of conversations · 1.5-second typical response · ~$0.018 per conversation.

[README](./hostzera-chat-widget) · [Architecture](./hostzera-chat-widget/architecture.md) · [Performance](./hostzera-chat-widget/PERFORMANCE.md) · [Tests](./tests/hostzera.test.js)

### Brand-Voice AI Agents — Climate-Tech Company (X & Instagram)
**n8n · AWS Bedrock · Apify · Unipile · Google Sheets · JavaScript**

<table>
  <tr>
    <td width="50%"><a href="./x-engagement-system"><img src="./x-engagement-system/x-engagement-workflow.jpg" alt="Brand-voice AI agent for X workflow" width="100%"></a></td>
    <td width="50%"><a href="./instagram-engagement-system"><img src="./instagram-engagement-system/instagram-engagement-workflow.jpg" alt="Brand-voice AI agent for Instagram workflow" width="100%"></a></td>
  </tr>
</table>

Two AI agents that represent a climate-tech company on X and Instagram. They find conversations where the company's expertise adds value, and **an AWS Bedrock classifier decides which deserve a response** — a test of topic, substance and fit, returned as structured JSON. The classifier fails closed and declines memes, venting and posts about tragedies. Every reply is written in the company's expert voice and passes brand-safety guardrails before it goes live: daily caps, one reply per author, active hours, a similarity check against recent replies, and a lock that prevents double-posting. A self-healing queue recovers work interrupted by a restart, and repeated failures are held for human review.

**Impact (in production):** the equivalent of 1–2 hours of expert work every day · up to 24 expert replies a day on X · Instagram handled end to end, from discovery to published comment.

[X agent](./x-engagement-system) · [Instagram agent](./instagram-engagement-system)

### Document Intelligence Pipeline — Construction Specifications
**n8n · OpenAI (gpt-4o) · JavaScript · Gmail · Google Sheets**

![Document intelligence pipeline workflow](./document-automation-system/document-automation-workflow.png)

Turns construction specification PDFs into structured Excel outputs, with a QA report on every run. Specifications arrive by email; the LLM extracts each handling instruction ("reuse 40%, dispose 30%") as a structured rule, exactly as written; **every calculation, aggregation and validation then runs in deterministic code**; and a QA gate sends any run with warnings to human review instead of delivering it.

**Impact:** 1,200 documents processed in a 90-day sample · 15–30 seconds per PDF · ~$0.03–0.05 per document · zero LLM arithmetic — every number is computed in tested code.

[README](./document-automation-system) · [Architecture](./document-automation-system/architecture.md) · [Performance](./document-automation-system/PERFORMANCE.md) · [Tests](./tests/document-automation.test.js)

### AI Prospecting & Outreach Pipeline
**n8n · Apify · ZeroBounce · OpenAI (gpt-4o) · Google Sheets · Telegram**

![AI prospecting and outreach pipeline workflow](./lead-generation-system/lead-generation-workflow.png)

Verifies leads and drafts personalized outreach for each campaign every week. Businesses are collected from Google Maps, normalized and **deduplicated by email, phone and domain** against every existing lead; email addresses are verified with ZeroBounce; gpt-4o drafts a personalized message; and **nothing is sent until an operator approves it in Telegram**.

**Impact:** <2% bounce rate · 8–12% reply rate · ~150 verified, approved leads per week per campaign · ~$0.04–0.08 per lead.

[README](./lead-generation-system) · [Architecture](./lead-generation-system/architecture.md) · [Performance](./lead-generation-system/PERFORMANCE.md) · [Tests](./tests/lead-generation.test.js)

---

## More systems

<table>
  <tr>
    <td width="50%" valign="top">
      <a href="./gym-lead-management"><img src="./gym-lead-management/gym%20workflow.jpg" alt="Fitness lead-to-member pipeline workflow" width="100%"></a><br>
      <b><a href="./gym-lead-management">Fitness Lead-to-Member Pipeline</a></b> · <sub>Production, single location</sub><br>
      <sub>Captures leads from WhatsApp, Instagram and Messenger, qualifies them with AI and books trial classes: <b>1,450</b> inbound messages → <b>522</b> trials → <b>137</b> new members in 90 days</sub>
    </td>
    <td width="50%" valign="top">
      <a href="./beauty-center-reception-workflow"><img src="./beauty-center-reception-workflow/beauty%20center%20workflow.jpg" alt="AI booking concierge workflow" width="100%"></a><br>
      <b><a href="./beauty-center-reception-workflow">AI Booking Concierge — Beauty & Wellness</a></b> · <sub>Production</sub><br>
      <sub>Matches informal requests to the right service and specialist, then books the slot: <b>86%</b> matched on the first message · <b>zero</b> double bookings</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <a href="./holistic-wellness-club"><img src="./holistic-wellness-club/screenshots/photo_1_2026-02-20_08-16-52.jpg" alt="Client lifecycle system pipeline" width="100%"></a><br>
      <b><a href="./holistic-wellness-club">Client Lifecycle System — Wellness Club</a></b> · <sub>Built and tested in staging</sub><br>
      <sub>GoHighLevel + n8n: bookings, reminders, lead nurturing and review requests in one client journey, with an event log that blocks duplicate webhooks</sub>
    </td>
    <td width="50%" valign="top">
      <a href="./marketing-lead-engine"><img src="./marketing-lead-engine/marketing-lead-engine-workflow.png" alt="Permission-first AI content pipeline workflow" width="100%"></a><br>
      <b><a href="./marketing-lead-engine">Permission-First AI Content Pipeline</a></b> · <sub>Working build</sub><br>
      <sub>Turns industry articles into credited LinkedIn drafts and asks for each author's consent first — using only contacts the publisher lists</sub>
    </td>
  </tr>
</table>

---

## Engineering standards

Every system meets the same engineering standards, **checked automatically on every push**. Details in [`PATTERNS.md`](./PATTERNS.md), [`SECURITY.md`](./SECURITY.md) and [`tests/`](./tests).

| Standard | How it is implemented |
|---|---|
| **AI for language, code for math** | LLMs classify, extract and write; availability, quantities and deduplication are computed in code |
| **Resilience** | External reads and AI calls retry 3× (2 s apart); outbound sends and bookings are never auto-retried, so a retry can't double-message or double-book |
| **Observability** | Every workflow reports to the [shared error handler](./shared-error-handler): a sanitized log entry for every failure and a Slack alert for high-severity ones |
| **Human-in-the-loop** | Mandatory approval before outbound email, and human review of any document run with a warning |
| **Idempotency** | Event IDs, deduplication keys and posting locks prevent duplicate records, replies and posts when webhooks retry |
| **Data protection** | Secrets and personal data redacted from logs; minimal data in prompts; outreach only to verified contacts; designed around Saudi PDPL and GDPR principles |
| **Measurable outcomes** | The clinic's KPIs are defined in [SQL and Python](./clinic-booking-system/analytics) and cross-checked by tests on SQLite and PostgreSQL |
| **Automated tests** | [125+ checks](./tests) in JavaScript, Python and SQL run on every push — against the real code in each `workflow.json` — and prevent regressions of the bugs found while building the suite ([details](./tests/README.md#bugs-found-and-fixed-while-building-the-suite)) |

---

## Career & project origins

| Period | Role | Systems in this repository |
|---|---|---|
| Jun 2026 – present | **AI Engineer, Quara Holding** | Confidential (see *Current role*) |
| Jan – Jun 2026 | **AI Automation Engineer, Hostzera** (web hosting, Netherlands) | [RAG Sales & Support Assistant](./hostzera-chat-widget) · integrations that eliminated **80%** of manual data entry across HubSpot, Airtable and GoHighLevel |
| Jul – Dec 2025 | **AI Automation Engineer, OMB** (marketing agency, Netherlands) | [AI Prospecting & Outreach Pipeline](./lead-generation-system) · lead systems processing **150+ leads a month** · an AI content workflow that cut production time by **70%** |
| Jan – Jun 2025 | **Independent — healthcare, fitness & beauty clients** | [Healthcare AI Receptionist](./clinic-booking-system) · [Fitness Lead-to-Member Pipeline](./gym-lead-management) · [AI Booking Concierge](./beauty-center-reception-workflow) · [Client Lifecycle System](./holistic-wellness-club) |
| Client & independent builds | Construction, climate-tech and content | [Document Intelligence Pipeline](./document-automation-system) · [Brand-Voice AI Agents — X](./x-engagement-system) and [Instagram](./instagram-engagement-system) · [Permission-First AI Content Pipeline](./marketing-lead-engine) |

---

## Skills & tech stack

Mirrors my CV; tools in *italics* are demonstrated in this repository.

| Area | Skills and tools |
|---|---|
| **AI & LLMs** | LLM applications · AI agents · RAG · prompt engineering · LLM evaluation · Claude, GPT & Gemini APIs · *AWS Bedrock* · *structured JSON outputs* |
| **Automation** | Workflow orchestration (n8n, Make, Zapier) · REST APIs & webhooks · GoHighLevel · WhatsApp Business API · *Messenger, Instagram, Telegram, Gmail, Slack* |
| **Data & CRM** | Clay · LinkedIn Sales Navigator · HubSpot · Airtable · Zoho · data enrichment & lead scoring · *Apify, ZeroBounce, Google Sheets, Google Calendar* |
| **Engineering** | Python, JavaScript & SQL (working knowledge) · Git/GitHub · Docker · VPS deployment · Claude Code/Cursor · *PostgreSQL data modeling, KPI analytics in Python, automated testing, GitHub Actions CI* |
| **Governance** | Monitoring & logging · consent and audit trails · human-in-the-loop review · data privacy (Saudi PDPL, GDPR) |
| **Languages** | Arabic (native) · English (fluent) |

---

## Repository structure

```
├── <project>/                 one folder per system
│   ├── README.md              what it does, impact, stack, scope of the export
│   ├── architecture.md        Mermaid diagrams, design decisions, data model, failure modes
│   ├── PERFORMANCE.md         metrics, cost, reliability and scale limits
│   ├── code_examples.md       code taken from the workflow's nodes
│   └── workflow.json          sanitized n8n export (importable after replacing placeholder credentials)
├── clinic-booking-system/analytics/   KPI analytics (Python) and PostgreSQL schema + KPI queries (SQL)
├── shared-error-handler/      the error workflow every system reports to
├── tests/                     automated tests run against each workflow.json
├── PATTERNS.md                cross-cutting engineering patterns
└── SECURITY.md                data handling, PDPL / GDPR, known limits
```

The X and Instagram agents ship with a README and workflow diagram; their exports are available on request. Where a screenshot shows the original build and differs from `workflow.json`, the project README says so — the JSON is the reference implementation against which the tests run.

---

## Notes

- All `workflow.json` files are **sanitized templates**: credentials are `REPLACE_*` placeholders and configuration comes from `$env.*` variables. No client data, keys or production URLs are included — see [`SECURITY.md`](./SECURITY.md).
- Metrics come from each system's `PERFORMANCE.md`, which states the measurement window and method.
- I'm happy to walk through any system in a technical review — [get in touch](mailto:khaledabdelaziz1330@gmail.com).
