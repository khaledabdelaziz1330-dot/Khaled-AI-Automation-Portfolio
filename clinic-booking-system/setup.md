# Setup & Deployment — Clinic AI Receptionist

How to deploy this workflow to a self-hosted n8n instance and configure it for a clinic.

---

## Prerequisites

- n8n instance (self-hosted via Docker recommended) — `n8n v1.x` or newer
- OpenAI API key with GPT-4 access
- Google Cloud project with Calendar API and Sheets API enabled
- WhatsApp Business API access (via Meta Cloud API)
- Optional: Instagram Business account connected to Facebook Page, Messenger access, Telegram Bot Token
- Slack workspace for error alerts (optional but recommended)

## Step 1 — Import the workflow

```bash
# Download the workflow JSON
# In n8n: Workflows → Import from File → workflow.json
```

The imported workflow will contain placeholder credentials. You'll connect real credentials in Step 2.

## Step 2 — Configure credentials

In n8n → Credentials, create the following:

| Credential | Type | Required fields |
|---|---|---|
| OpenAI API | OpenAI API | `apiKey` (from platform.openai.com) |
| Google Sheets | Google Sheets OAuth2 | OAuth flow with Sheets read/write scope |
| Google Calendar | Google Calendar OAuth2 | OAuth flow with Calendar read/write scope |
| WhatsApp Business | HTTP Header Auth | `Authorization: Bearer <META_ACCESS_TOKEN>` |
| Telegram Bot | Telegram | Bot token from @BotFather |
| Slack (errors) | Slack OAuth2 | OAuth flow with `chat:write` |

## Step 3 — Configure Google Sheets data layer

Create a Google Sheet with these tabs:

### Tab: `Conversations`
| Column A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| timestamp | user_id | user_name | channel | direction | message_text | intent | booking_id | status |

### Tab: `Bookings`
| Column A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| booking_id | patient_name | phone | service | start_datetime | end_datetime | channel | status | created_at |

### Tab: `FAQ_Knowledge`
| Column A | B | C |
|---|---|---|
| question_keywords | answer | language |

### Tab: `Services`
| Column A | B | C |
|---|---|---|
| service_name | duration_minutes | price |

Copy the Sheet ID (from the URL) and paste it into the workflow's "Sheet ID" variables.

## Step 4 — Configure environment variables

In your n8n instance, set the following environment variables:

```bash
CLINIC_NAME="Your Clinic Name"
CLINIC_ADDRESS="Full clinic address"
CLINIC_PHONE="+1234567890"
BUSINESS_HOURS_START=9  # 9 AM
BUSINESS_HOURS_END=19  # 7 PM
SLOT_DURATION_MIN=30
BUFFER_BETWEEN_BOOKINGS_MIN=15
DEFAULT_LANGUAGE="en"  # or "ar" for Arabic-first
TIMEZONE="Africa/Cairo"  # or your clinic's timezone
SLACK_ERROR_CHANNEL="#clinic-bot-errors"
```

## Step 5 — Set up webhook endpoints

The workflow exposes one webhook URL. You'll need to point each channel at it:

```
https://your-n8n-instance.com/webhook/clinic-receptionist
```

### WhatsApp
Configure your Meta Cloud API webhook:
- Callback URL: the webhook URL above
- Verify Token: any string (also set in workflow)
- Subscribe to `messages` field

### Instagram
Same Meta webhook — Instagram messages are routed through the Messenger Platform.

### Messenger
Add the webhook URL to your Facebook App → Messenger → Webhooks.

### Telegram
```bash
curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook \
  -d "url=https://your-n8n-instance.com/webhook/clinic-receptionist"
```

## Step 6 — Customize the FAQ knowledge base

In the `FAQ_Knowledge` tab, add common questions and answers:

| question_keywords | answer | language |
|---|---|---|
| price, cost, how much, fees | Our consultation fee is $50. Treatment prices depend on your needs. | en |
| hours, open, time | We are open Monday-Friday 9am-7pm, Saturday 10am-3pm. | en |
| location, address, where | We are at [CLINIC_ADDRESS]. Free parking available. | en |
| سعر, ثمن, كام | الكشف بـ 50 دولار. أسعار العلاج تختلف حسب الحالة. | ar |

The AI uses these to ground its responses — no hallucination, no made-up prices.

## Step 7 — Activate workflows

In n8n:
1. Open the imported workflow
2. Test the webhook with a test message
3. Verify the response appears in your messaging channel
4. Toggle the workflow to **Active**

## Step 8 — Set up monitoring

The workflow includes a connected Error Trigger that:
1. Captures any failure
2. Sanitizes sensitive data
3. Sends a Slack alert with full context

**Recommended Slack channels:**
- `#clinic-bot-errors` — every error
- `#clinic-bot-summary` — daily digest of bookings and metrics

## Step 9 — Initial testing checklist

Before going live:

- [ ] Send "hi" from each channel — verify greeting response
- [ ] Send "how much is a cleaning?" — verify FAQ lookup works
- [ ] Send "I want to book a cleaning tomorrow at 3pm" — verify booking flow
- [ ] Send "تقدر تحجزلي بكره؟" (Arabic) — verify bilingual handling
- [ ] Send gibberish — verify polite handoff response
- [ ] Force an error (invalid API key) — verify Slack alert fires
- [ ] Check booking appears in Google Calendar
- [ ] Check conversation logged in Google Sheets
- [ ] Wait for 24-hour reminder timing — verify it sends

## Step 10 — Go live

When everything passes testing:
1. Inform clinic staff of the new system
2. Document the escalation path (which messages route to a human)
3. Monitor Slack alerts for the first week
4. Review conversation logs daily for the first month to tune prompts

## Maintenance

| Task | Frequency |
|---|---|
| Review conversation logs for prompt improvement | Weekly (first month), then monthly |
| Check Slack errors | Daily |
| Update FAQ knowledge base | As clinic adds services |
| Review booking conversion metrics | Monthly |
| Update business hours / holidays | As needed |
| n8n version updates | Quarterly |

## Cost estimate (per month)

| Item | Cost |
|---|---|
| n8n self-hosted (VPS) | $5–$20 |
| OpenAI API (1000 conversations) | $30–$60 |
| WhatsApp Business API | $0–$50 (volume-based) |
| Google Workspace | $0 (free tier sufficient) |
| **Total** | **~$50–$150/month** |

Compare to ~$2,000/month for a full-time receptionist handling the same workload.

## Troubleshooting

### Bot doesn't respond
1. Check workflow is **Active** in n8n
2. Check webhook URL matches channel configuration
3. Check OpenAI credit is not exhausted
4. Check Slack error channel for recent failures

### Bookings not appearing in Calendar
1. Verify Google Calendar OAuth is still authorized
2. Check Calendar ID is correct in workflow variables
3. Test Calendar API access manually via n8n credentials test

### Responses are slow (>5 seconds)
1. Check OpenAI status page for outages
2. Reduce conversation history retrieved (5 → 3 messages)
3. Switch intent classifier to gpt-4o-mini if using gpt-4o

### Wrong language in responses
1. Verify `DEFAULT_LANGUAGE` env variable
2. Check prompt explicitly instructs "reply in the same language as the user"
3. Add language detection node before AI calls

## Contact

For questions about this deployment or customization help:
- **LinkedIn:** [Khaled Abdelaziz](https://linkedin.com/in/khaledabdelaziz-ai)
- **Email:** [khaledabdelaziz1330@gmail.com](mailto:khaledabdelaziz1330@gmail.com)
