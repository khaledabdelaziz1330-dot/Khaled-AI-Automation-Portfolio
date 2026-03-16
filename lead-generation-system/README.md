# Lead Generation & Outreach Engine

End-to-end lead scraping, enrichment, email verification, AI personalization, and automated outreach
(Google Maps Scraping · Email Verification · AI Outreach · Error Monitoring)

---

![lead generation workflow](lead-generation-workflow.png)

## What this system does

This is a full lead generation and outreach pipeline that automates the entire process from **finding prospects** to **sending personalized outreach emails** — with built-in deduplication, email verification, AI-powered personalization, and human approval before sending.

It:

- **Identifies and collects leads** from targeted businesses using Google Maps scraping.
- **Extracts contact details** — email addresses, phone numbers, company names, websites, and social profiles.
- **Checks for duplicates** against existing lead database to avoid contacting the same prospect twice.
- **Verifies email addresses** to ensure deliverability before outreach.
- **Generates personalized outreach emails** using AI, tailored to each lead's business, services, and potential pain points.
- **Waits for human approval** before sending — no email goes out without review.
- **Updates the lead database** with outreach status and tracking.
- **Monitors for errors** and alerts the team if anything fails.

---

## How it works (step by step)

### Phase 1: Lead Generation Engine (blue section)
1. **Google Maps Scraper** — searches for businesses matching target criteria (industry, location, size).
2. **Edit Fields** — structures the raw scraped data.
3. **Google Maps run actor** — executes the scraping job.
4. **Get runs / Get dataset items** — retrieves the collected business data.
5. **Retry if there is error** — built-in retry logic for failed scraping attempts.

### Phase 2: Deduplication & Lead Storage (blue section)
1. **Check for duplications** — compares new leads against existing database.
2. **Edit Fields** — normalizes contact information (phone formats, email formats, names).
3. **Get rows in sheet** — loads existing leads from Google Sheets.
4. **Merge** — combines new leads with existing data, removing duplicates.
5. **Code in JavaScript** — custom deduplication and data cleaning logic.
6. **Append row in sheet** — stores verified new leads in the database.

### Phase 3: Email Verification (red section)
1. **Get rows in sheet** — loads leads pending email verification.
2. **Validate email** (ZeroBounce) — verifies each email address for deliverability.
3. **Filter** — separates valid emails from invalid ones.

### Phase 4: AI Personalization & Email Generation (blue section)
1. **Generate email** (OpenAI) — creates a personalized outreach email based on the lead's business, website, services, and potential pain points.
2. **Edit Fields** — formats the generated email.
3. **Review & edit** — human review step for quality control.

### Phase 5: Approval & Sending (blue section)
1. **Wait for approval to send the email** — pauses until a team member approves.
2. **Send emails to leads** (Gmail) — sends the approved email.
3. **Update the leads sheet** — marks the lead as contacted with timestamp.

### Phase 6: System Monitor (error handling)
1. **Error Trigger** — catches any failure in the pipeline.
2. **Log the error** — records the failure in a dedicated error sheet.
3. **Notify the team** — sends an alert via email.

---

## Workflow architecture

```
Lead Generation Engine (scraping)
  → Check for Duplications → Append the Leads
    → Email Verification (ZeroBounce)
      → AI Personalization & Generate Email
        → Wait for Approval → Send Email → Update Leads

System Monitor
  → Error Trigger → Log error + Notify team
```

---

## Stack

- **n8n** (self-hosted on VPS) – main orchestration
- **Google Maps Scraper** (Apify actor) – business data collection
- **ZeroBounce** – email verification and validation
- **OpenAI** – personalized email generation
- **Google Sheets** – lead database, error logs, tracking
- **Gmail** – outreach email sending
- **JavaScript** – custom deduplication and data processing logic

---

## Outreach focus areas

The AI-generated emails target value propositions around:
- **Increasing revenue** — lead capture, conversion optimization
- **Reducing losses** — no-show recovery, missed inquiry prevention
- **Saving time** — automation of repetitive tasks
- **Reducing manual effort** — CRM updates, scheduling, follow-ups
- **Solving workflow problems** — multi-channel consolidation, data organization

---

## Impact

- **Automated prospecting** — finds and collects leads without manual research.
- **Zero duplicate outreach** — deduplication prevents contacting the same business twice.
- **Verified emails only** — email validation ensures high deliverability and protects sender reputation.
- **Personalized at scale** — AI writes unique emails for each prospect, not templates.
- **Human-in-the-loop** — approval step ensures quality control before any email is sent.
- **Full audit trail** — every lead, email, and status change is tracked in Google Sheets.

---

## Notes

- The Google Maps scraping criteria (industry, location, keywords) are fully configurable per campaign.
- The approval step is intentional — this is not a spam tool. Every email is reviewed before sending.
- Built with production-grade error handling: retry logic on scraping, error logging, and team alerts.
- Can be extended to include LinkedIn scraping, additional enrichment sources, and multi-channel outreach (WhatsApp, LinkedIn DMs).
