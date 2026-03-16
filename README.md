# AI Automation Engineer | n8n, GoHighLevel, APIs & Workflow Systems

Building end-to-end automation systems for marketing agencies, web hosting, clinics, and service businesses.

---

## Profile

AI Automation Engineer with 2 years of experience designing production-ready workflow systems using n8n (self-hosted), GoHighLevel, and API integrations. Background in dental practice (BDS) gives me deep domain expertise in healthcare operations — I started by solving real problems I saw in clinics, then expanded into marketing, lead generation, and web hosting automation.

Every workflow I build is designed with structured logging, error monitoring, retry logic, and safe human handover — not just demos, but systems that run reliably in production.

**Currently:** AI Automation Engineer at **Hostzera** (Web Hosting & Marketing)
**Previously:** AI Automation Engineer at **OMB** (Marketing Agency, Netherlands)

---

## Featured Systems

### 1. Hostzera – AI Chat Widget & Lead Automation (Current)

**Stack:** n8n (self-hosted) · GoHighLevel · HubSpot · Airtable · WhatsApp API · Google Sheets

![hostzera chat widget](./hostzera-chat-widget/chat-widget-workflow.png)

- Built an **AI-powered chat widget** for the Hostzera website that handles visitor inquiries, qualifies leads, and routes conversations to the right sales team in real time.
- Designed **lead generation pipelines** capturing prospects from multiple channels, with automated scoring, enrichment, deduplication, and CRM routing.
- Integrated **HubSpot, Airtable, and GoHighLevel** into a unified automation layer, reducing manual data entry by ~60%.
- Built automated **upsell and renewal reminder** sequences to improve client retention.

**Impact:**
- 24/7 lead qualification — visitors get instant responses at any hour.
- Sales team focuses only on pre-qualified leads instead of raw inquiries.

[View details →](./hostzera-chat-widget)

---

### 2. Lead Generation & Outreach Engine

**Stack:** n8n · Google Maps Scraper · ZeroBounce · OpenAI · Google Sheets · Gmail

![lead generation workflow](./lead-generation-system/lead-generation-workflow.png)

- End-to-end pipeline: **Google Maps scraping → deduplication → email verification → AI-personalized outreach → human approval → sending**.
- Collects business leads with contact details, verifies emails via ZeroBounce, and generates personalized outreach using AI.
- **Human-in-the-loop** — approval step ensures every email is reviewed before sending.
- Built-in error monitoring with logging and team notifications.

**Impact:**
- Automated prospecting eliminates hours of manual research per campaign.
- Verified emails protect sender reputation and ensure deliverability.

[View details →](./lead-generation-system)

---

### 3. Document Automation System

**Stack:** n8n · OpenAI · Google Sheets · Google Drive · Gmail · JavaScript

![document automation workflow](./document-automation-system/document-automation-workflow.png)

- AI-assisted pipeline that transforms **construction specification PDFs** into structured Excel outputs.
- LLM extracts action signals (reuse, dispose, clean, package, transport) from natural-language instructions. **All calculations are deterministic code** — no LLM math.
- Includes duplicate detection, quantity conservation validation, QA reporting, and automated error handling.
- Full error monitoring with logging and team email alerts.

**Impact:**
- Hours of manual document processing automated into pipeline runs.
- Zero calculation errors — deterministic code handles all math.
- Full audit trail with QA reports for every run.

[View details →](./document-automation-system)

---

### 4. Holistic Wellness Club – GHL + n8n Ecosystem

**Stack:** GoHighLevel · n8n · JavaScript · WhatsApp API · Google Sheets · Google Calendar

- Business context: Wellness club offering yoga, meditation, retreats, and holistic cooking programs.
- **GoHighLevel (Patient Journey):**
  - Pipelines for Leads → Bookings → Attendance → No-shows / Re-engagement.
  - Workflows for appointment confirmation, reminders, and post-visit review requests.
- **n8n (Brain & Monitor):**
  - Receives webhooks from GHL (new leads, new bookings, status changes).
  - Normalizes and logs all events into Google Sheets (audit + reporting layer).
  - Creates booking snapshots for analytics.
- **Resilience & Monitoring:**
  - Dedicated Error Trigger flow that logs any failed step to a separate Errors sheet.
  - Sends instant alerts to the team via email/Discord when a webhook or API call fails.

**Impact:**
- Front-desk manual work on reminders & tracking reduced by **~70%**.
- Clear visibility across Calendar / Pipelines / Automations from one place.

[View details →](./holistic-wellness-club)

---

### 4. Clinic Booking System – AI Receptionist

**Stack:** n8n (self-hosted) · OpenAI · WhatsApp / Messenger / Telegram · Google Sheets · Google Calendar

- Replaces manual receptionist chat with an **AI assistant** that handles patient inquiries across WhatsApp, Messenger, Instagram, and Telegram.
- Centralizes all inquiries into structured rows in Google Sheets.
- Syncs appointments with Google Calendar, with automatic confirmation and reminder flows.
- Tracks every inquiry, appointment, and status change for reporting.

**Impact:**
- **90%+ of initial inquiries** handled end-to-end by automation.
- Response time dropped to **under 2 minutes** instead of waiting for a human reply.

[View Loom Demo →](https://www.loom.com/share/5e571af3da7c41edb6a80c1c5604876d)
[View details →](./clinic-booking-system)

---

### 6. Smart Lead Engine for Marketing Agencies

**Stack:** n8n · RSS / External APIs · OpenAI · Slack / Email · Google Sheets or SQL

- Pulls content ideas and topics from RSS feeds/APIs and enriches them with AI.
- Scores and tags leads/content opportunities based on intent and relevance.
- Sends alerts to Slack/email whenever high-intent leads or trending topics are detected.
- Designed as a reusable engine that agencies can plug into different campaigns.

[View details →](./marketing-lead-engine)

---

### 7. Gym Lead Management – Trials & Memberships

**Stack:** n8n · OpenAI · WhatsApp / Instagram / Messenger · Google Sheets · Google Calendar

- Captures all incoming messages (WhatsApp / Instagram / Messenger) and turns them into a structured lead pipeline (Member / Hot / Trial / Lost).
- Automates trial-class booking and follow-up messages.
- Eliminates manual data entry into Sheets.

**Impact:**
- Designed to handle 150+ leads/month with full traceability.
- Automatically sends personalized gym offers to active leads.

[View details →](./gym-lead-management)

---

### 8. Beauty Center Reception Workflow

**Stack:** n8n · OpenAI · WhatsApp · Instagram · Messenger · Google Sheets · Google Calendar

- Centralizes messages from multiple channels into one reception workflow.
- Suggests service types, books appointments, and syncs them with Calendar.
- Tracks customers, preferences, and visit history in Sheets.

**Impact:**
- Brings 3+ channels into a single system with automated follow-ups.
- Reduces missed messages and forgotten bookings across the team.

[View details →](./beauty-center-reception-workflow)

---

## Additional Business Use Cases

Beyond the systems above, I design custom n8n automations for private and field-based businesses, such as:

- HVAC and maintenance companies
- Home services (cleaning, repairs, technicians)
- Small agencies and local service providers

Typical patterns:
- Centralizing all WhatsApp / Messenger / Instagram / Telegram inquiries into Google Sheets (as a simple CRM).
- Google Calendar booking with automated time-slot selection.
- Reminder and follow-up flows so no lead, job, or payment is forgotten.

---

## Tech Stack

### Automation & AI
- **n8n** (self-hosted on VPS via Docker)
- **GoHighLevel** (pipelines, workflows, automations)
- **Claude Code** (rapid development, debugging, API integrations)
- **OpenAI API** (conversational flows, content generation, decision logic)
- **Make / Zapier** (additional automation platforms)

### CRMs & Data
- **HubSpot** · **Zoho** · **Airtable** · **Google Sheets**
- Google Calendar API (scheduling)
- Webhooks & REST API integrations

### Messaging Platforms
- WhatsApp Business API
- Meta Messenger Platform
- Instagram Direct
- Telegram Bot API
- Slack

### Programming
- JavaScript (n8n function nodes, custom logic, API handling)
- Python (data processing, scripting)
- SQL (database queries, reporting)

### Infrastructure
- Hostinger VPS (self-hosted n8n via Docker)
- Structured logging, retry logic, error monitoring
- Discord/email alerting for production failures

---

## Where These Workflows Fit

These automations are built for:

- **Web Hosting Companies** – chat widgets, lead qualification, client onboarding, upsell automation
- **Marketing Agencies** – lead generation, content pipelines, campaign automation
- **Construction & Engineering** – document processing, specification automation, QA reporting
- **Clinics & Medical Practices** – patient booking, reminders, FAQ automation
- **Gyms & Fitness Centers** – lead capture, trials, membership retention
- **Beauty Centers & Salons** – multi-service booking & customer follow-up
- **Private / Service Businesses** – reception automation, lead qualification, job tracking

---

## Contact

- **LinkedIn:** [Khaled Abdelaziz](https://www.linkedin.com/in/khaled-abdelaziz-20b05a393)
- **Email:** [khaledabdelaziz1330@gmail.com](mailto:khaledabdelaziz1330@gmail.com)
- **GitHub:** [Portfolio](https://github.com/khaledabdelaziz1330-dot/Khaled-AI-Automation-Portfolio)

---

## Notes

- Workflow screenshots and documentation are available in each project folder.
- n8n JSON exports can be shared for technical review or test deployment.
- All systems are designed with real production constraints: errors, retries, logging, monitoring, and safe handover to humans.
