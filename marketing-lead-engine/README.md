# Smart Marketing Lead Engine (n8n)

Automation system that turns newly published articles into  
permission-based social posts and warm leads for marketing agencies.

<img width="1920" height="889" alt="image" src="https://github.com/user-attachments/assets/13a8fba5-ffe3-4d30-861a-c10306f0b079" />

---

## 🔧 Tech Stack

- Automation: n8n (self-hosted)
- AI: OpenAI (rewriting + summarizing)
- Storage: Google Sheets (queue + status)
- Email: Gmail / SMTP
- Publishing: LinkedIn / other socials via API

---

## ⚙️ How It Works (Pipeline)

1. Fetch New Articles
   - Pulls latest articles from RSS / APIs on a schedule.
   - Skips duplicates based on URL in Google Sheets.

2. Generate Draft Content
   - Uses AI to:
     - Rewrite the article into 1–2 LinkedIn-style posts.
     - Create a short email pitch summarizing the article.
   - Saves drafts + metadata in Google Sheets.

3. Ask Author for Permission
   - Sends a polite email to the original author:
     - Explains who we are.
     - Shares the draft post.
     - Asks for clear YES / NO to publish and tag them.
   - Updates status: pending, approved, declined, no response.

4. Auto-Publishing
   - If approved → posts automatically to LinkedIn / selected channels.
   - Stores published_at + post URL for tracking.

5. Monitoring & Errors
   - Logs failures (API, email, etc.) to a Log sheet.
   - Sends alerts on critical errors so flows can be fixed quickly.

---

## 📈 Impact

- Builds a consistent content pipeline without constant manual writing.
- Keeps outreach ethical & permission-based (no content theft).
- Gives agencies a clear history of:
  - Who approved what
  - Where it was posted
  - What’s still pending

---

## 💬 Notes

- This is a portfolio project showing how I design real-world  
  marketing automations in n8n with approvals, logging, and monitoring.
