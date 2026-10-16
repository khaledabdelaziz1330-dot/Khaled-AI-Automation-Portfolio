# AI Prospecting & Outreach Pipeline

Lead scraping, deduplication, email verification and AI-personalized outreach drafts, gated by mandatory human approval
(Google Maps Scraping · Email Verification · AI Personalization · Telegram Approval)

---

![lead generation workflow](lead-generation-workflow.png)

*Screenshot: the workflow as originally built in the n8n editor, including the send stage. The exported [`workflow.json`](workflow.json) is the sanitized reference version of the generation-and-approval pipeline; it ends at the approval queue, and this documentation describes `workflow.json`.*

---

## What This System Does

A lead generation pipeline that automates the work from **finding prospects** to **a reviewed, ready-to-send outreach draft**, with deduplication, email verification and AI personalization built in. No email leaves the system without explicit operator approval.

**Key features:**

- Runs weekly per active campaign, with search query, location and result limit configured in a Google Sheet
- Collects businesses from Google Maps via the Apify `crawler-google-places` actor
- Extracts business name, email, phone, website, address, city, country, category, rating and review count; leads without an email are dropped
- Deduplicates against the campaign's existing leads on three signals: email, normalized phone and website domain
- Verifies every email with ZeroBounce; only `valid` or `catch-all`, non-free, non-disposable addresses proceed
- Generates a personalized subject and body per lead with OpenAI `gpt-4o`
- Sends each draft to an operator on Telegram with **Approve / Edit / Reject** buttons
- Queues every draft in a `PendingApprovals` sheet with an approval ID and a 48-hour response deadline

---

## How It Works

### Phase 1: Campaign Intake & Scraping
1. **Weekly Monday 9AM** — schedule trigger (`0 9 * * 1`)
2. **Get Active Campaigns** — reads campaigns with `status = active` from the campaigns sheet
3. **Apify Google Maps Scrape** — runs the Google Maps actor synchronously with the campaign's query, location and result limit (default 100)
4. **Extract Lead Fields** — maps Apify results to lead records and drops businesses with no email

### Phase 2: Deduplication
1. **Get Existing Leads** — loads the campaign's leads from the `AllLeads` sheet
2. **Deduplicate** — rejects any lead whose email, digits-only phone or website domain is already known, including duplicates within the same batch, and assigns a `lead_id` to each new lead

### Phase 3: Email Verification
1. **ZeroBounce Verify** — validates each address (10 s timeout, up to 3 attempts, 2 s apart)
2. **Filter Verified** — computes `should_send` from verification status, free-provider flag and disposable status
3. **Is Verified?** — only verified leads continue

### Phase 4: AI Personalization
1. **AI Personalization** — `gpt-4o` (temperature 0.7, JSON mode) writes an email of at most 80 words that references a specific detail of the business, leads with its pain point and closes with a single call to action; the model also reports which detail it used

### Phase 5: Human Approval Request
1. **Build Approval Record** — assembles the approval ID, lead, draft, personalization signal, `pending_review` status and 48-hour deadline
2. **Send Telegram Approval** — posts the draft to the operator chat with Approve / Edit / Reject inline buttons
3. **Queue Approval** — appends the record to the `PendingApprovals` sheet

Handling the operator's decision and sending approved emails are outside this export: `workflow.json` ends at the approval queue. Failures are routed to the portfolio's [shared error handler](../shared-error-handler) through the workflow's `errorWorkflow` setting.

---

## Workflow Architecture

```
Weekly Monday 9AM (schedule)
  → Get Active Campaigns (Sheets)
    → Apify Google Maps Scrape (HTTP)
      → Extract Lead Fields
        → Get Existing Leads (Sheets) + Deduplicate
          → ZeroBounce Verify (HTTP) → Filter Verified → Is Verified?
            → AI Personalization (OpenAI gpt-4o)
              → Build Approval Record
                ├── Send Telegram Approval (Approve / Edit / Reject)
                └── Queue Approval (Sheets: PendingApprovals)

errorWorkflow → shared error handler
```

---

## Stack

| Layer | Tools |
|---|---|
| **Orchestration** | n8n (self-hosted on VPS) |
| **Lead Scraping** | Apify Google Maps actor (`compass~crawler-google-places`) |
| **Email Verification** | ZeroBounce |
| **AI** | OpenAI `gpt-4o` (personalized email drafts, JSON output) |
| **Human Approval** | Telegram bot with inline buttons |
| **Data** | Google Sheets (campaigns, lead database, approval queue) |
| **Logic** | JavaScript (field extraction, deduplication, verification filter, approval records) |

---

## Outreach Focus

The prompt frames the offer as AI automation that answers customer inquiries 24/7 across WhatsApp, Instagram and email, and instructs the model to:
- Lead with the prospect's pain point, not the solution
- Reference a concrete detail: category, location or rating
- Stay under 80 words with one call to action (a 15-minute call)
- Avoid stock openers ("hope this finds you well", "circling back", "just touching base")

---

## Impact

Measured across agency outreach campaigns (see [PERFORMANCE.md](PERFORMANCE.md)):

- **<2% bounce rate** after ZeroBounce filtering
- **8–12% reply rate** on well-targeted lists
- **~150 verified, personalized, human-approved leads per week** per active campaign
- **~75% of AI drafts approved as written**, ~20% approved after edits, ~5% rejected
- **~$0.04–0.08 per lead** all-in; ~2 hours of operator review per 150 leads

---

## Notes

- Campaign targeting (query, location, result limit) is data in a Google Sheet, not workflow code
- The approval step is intentional; this is not a bulk-mail tool. Every draft is reviewed by a person before it can be sent
- Deduplication runs before verification, so ZeroBounce credits are never spent on a known lead
- Natural extensions: additional enrichment sources and multi-channel outreach
