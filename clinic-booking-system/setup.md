# Setup & Deployment — Clinic AI Receptionist

How to deploy [`workflow.json`](./workflow.json) to a self-hosted n8n instance and configure it for a clinic.

---

## Prerequisites

- n8n instance (self-hosted via Docker recommended) — `n8n v1.x` or newer
- OpenAI API key with access to `gpt-4o` and `gpt-4o-mini`
- Google Cloud project with the Calendar API and Sheets API enabled
- WhatsApp Business API access (Meta Cloud API)
- Optional: Instagram professional account connected to a Facebook Page, Messenger access, Telegram bot token
- The portfolio's [shared error handler](../shared-error-handler) imported, with a Slack workspace for alerts (recommended)

## Step 1 — Import the workflow

```bash
# In n8n: Workflows → Import from File → workflow.json
```

The imported workflow contains placeholder credential IDs (`REPLACE_*_CREDENTIAL_ID`). You connect real credentials in Step 2.

## Step 2 — Configure credentials

In n8n → Credentials, create the following and select them on the matching nodes:

| Credential | Type | Used by |
|---|---|---|
| OpenAI | OpenAI API | `Classify Intent`, `Extract Booking Details`, `Generate Booking Reply`, `Generate Greeting Reply` |
| Google Sheets | Google Sheets OAuth2 (read/write) | `Log Inbound to Sheets`, `Get Conversation History`, `Log Outbound to Sheets` |
| Google Calendar | Google Calendar OAuth2 (read) | `Get Calendar Events` |

Channel access tokens are **not** stored as n8n credentials in this workflow. They are read from environment variables inside `Send Reply via API` at request time, so they never appear in execution data (Step 4).

## Step 3 — Configure the Google Sheets data layer

Create a Google Sheet with a `Conversations` tab. The workflow appends to and reads from these columns:

### Tab: `Conversations`
| Column A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| timestamp | user_id | user_name | channel | direction | message_text | intent | status |

Copy the Sheet ID from the URL; it goes into `CONVERSATIONS_SHEET_ID` in Step 4.

## Step 4 — Configure environment variables

Set these on the n8n container. Every variable below is referenced by the workflow:

```bash
# Data
CONVERSATIONS_SHEET_ID="<google-sheet-id>"
CLINIC_CALENDAR_ID="<calendar-id>@group.calendar.google.com"

# Channel credentials (resolved inside "Send Reply via API" only)
WHATSAPP_PHONE_NUMBER_ID="<meta-phone-number-id>"
WHATSAPP_ACCESS_TOKEN="<meta-access-token>"
IG_ACCESS_TOKEN="<instagram-page-access-token>"
FB_PAGE_ACCESS_TOKEN="<facebook-page-access-token>"
TELEGRAM_BOT_TOKEN="<botfather-token>"

# n8n runtime
N8N_BLOCK_ENV_ACCESS_IN_NODE=false   # the workflow reads $env in node parameters
GENERIC_TIMEZONE="Africa/Cairo"      # matches the workflow's timezone setting
TZ="Africa/Cairo"                    # optional — slot math is time-zone independent (uses Africa/Cairo explicitly)
```

**Scheduling rules** (business hours 09:00–19:00, 30-minute slots, 15-minute buffer, 30-minute lead time, Fridays closed) are constants at the top of the `Calculate Availability` Code node. Edit them there for a different clinic.

## Step 5 — Set up webhook endpoints

The workflow exposes one POST webhook. Point every channel at it:

```
https://your-n8n-instance.com/webhook/clinic-receptionist
```

### WhatsApp
Configure the Meta Cloud API webhook:
- Callback URL: the webhook URL above
- Subscribe to the `messages` field

Meta verifies a webhook with a one-time `GET` request (`hub.challenge`). This export only registers the `POST` handler, so answer the verification with a `GET` webhook on the same path.

### Instagram
Same Meta app — subscribe the Instagram `messages` field to the same callback URL.

### Messenger
Add the webhook URL under your Facebook App → Messenger → Webhooks and subscribe to `messages` and `messaging_postbacks`.

### Telegram
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=https://your-n8n-instance.com/webhook/clinic-receptionist"
```

## Step 6 — Tailor the prompts to the clinic

All clinic-specific language lives in four OpenAI nodes:

| Node | What to change |
|---|---|
| `Classify Intent` | Clinic type in the first line; keep the seven labels unchanged (the Switch node matches them) |
| `Extract Booking Details` | The service list and timezone |
| `Generate Booking Reply` | Clinic location, tone and the "no slots" fallback message |
| `Generate Greeting Reply` | Greeting tone and word limit |

Keep the instruction *"Do NOT make up slot times. Use ONLY what is provided."* in `Generate Booking Reply` — it is what keeps the model from inventing availability.

## Step 7 — Connect error handling

1. Import the [shared error handler](../shared-error-handler) and configure its Sheets and Slack credentials
2. In this workflow, open **Settings → Error workflow** and select it (replaces `REPLACE_WITH_ERROR_WORKFLOW_ID`)

External API nodes already retry 3 times, 2 seconds apart. Only failures that survive those retries reach the error handler.

## Step 8 — Activate

1. Open the imported workflow
2. Send a test message from one channel
3. Verify the reply arrives in that channel and both rows appear in `Conversations`
4. Toggle the workflow to **Active**

## Step 9 — Pre-launch testing checklist

- [ ] Send "hi" from each channel — verify a greeting reply in the same channel
- [ ] Send "how much is a cleaning?" — verify it classifies as `FAQ` and gets a short reply
- [ ] Send "I want to book a cleaning tomorrow at 3pm" — verify up to 3 slots, all free in Google Calendar
- [ ] Reply "yes, the first one" — verify it classifies as `CONFIRMATION` and slots are re-checked
- [ ] Send "تقدر تحجزلي بكره؟" (Arabic) — verify the reply is in Arabic
- [ ] Send a complaint — verify no automated reply and an inbound row with no outbound row
- [ ] Open a finished execution — verify no access token appears in any node's output
- [ ] Force an error (invalid OpenAI key) — verify 3 tries, then a row in the `Errors` sheet

## Step 10 — Go live

1. Brief clinic staff on the new system
2. Document the escalation path: complaints and unclassified messages are left for staff, identified by inbound rows without an outbound reply
3. Monitor Slack alerts for the first week
4. Review conversation logs daily for the first month to tune prompts

## Maintenance

| Task | Frequency |
|---|---|
| Review conversation logs for prompt improvement | Weekly (first month), then monthly |
| Check Slack errors and the `Errors` sheet | Daily |
| Update the service list in the prompts | As the clinic adds services |
| Review booking conversion metrics | Monthly |
| Update business hours and closed days in `Calculate Availability` | As needed |
| Re-authorize Google OAuth credentials if expired | Roughly every 90 days |
| n8n version updates | Quarterly |

## Cost estimate (per month)

| Item | Cost |
|---|---|
| n8n self-hosted (VPS) | $5–$20 |
| API costs, small clinic (< 50 inquiries/day) | $15–$25 |
| API costs, medium clinic (50–150 inquiries/day) | $50–$90 |
| API costs, large / multi-location (150–500 inquiries/day) | $150–$300 |

API costs cover OpenAI and WhatsApp Business messaging; Google Sheets and Calendar stay within the free tier. Per-conversation breakdown in [`PERFORMANCE.md`](./PERFORMANCE.md).

## Troubleshooting

### Bot doesn't respond
1. Check the workflow is **Active**
2. Check the webhook URL matches each channel's configuration
3. Check the message wasn't classified `COMPLAINT` or `OTHER` (no automated reply by design)
4. Check OpenAI credit is not exhausted
5. Check the `Errors` sheet and Slack channel for recent failures

### Offered slots look wrong
1. Verify `CLINIC_CALENDAR_ID` points to the clinic's booking calendar
2. Verify the Google Calendar OAuth credential is still authorized
3. If the clinic is not in Cairo, change `CLINIC_TZ` at the top of `Calculate Availability` — slot generation does not depend on the server's `TZ`

### Responses are slow (> 5 seconds)
1. Check the OpenAI status page for degradation
2. Check executions for node retries (each retry waits 2 seconds)
3. Check the `Conversations` sheet size — the history lookup reads all of a patient's rows

### Wrong language in responses
1. Check the reply prompts still instruct the model to reply in the user's language
2. Check the incoming text was extracted correctly by `Normalize Payload`

## Contact

For questions about this deployment or customization:
- **LinkedIn:** [Khaled Abdelaziz](https://linkedin.com/in/khaledabdelaziz-ai)
- **Email:** [khaledabdelaziz1330@gmail.com](mailto:khaledabdelaziz1330@gmail.com)
