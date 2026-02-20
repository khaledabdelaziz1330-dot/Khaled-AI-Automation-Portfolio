# AI Automation Engineer | Health-Tech Specialist   
Building Agentic Workflows & Production-Ready Systems for Service Businesses

---

## 👤 Profile

I bridge the gap between clinical expertise (BDS) and advanced automation.  
I specialize in building self-hosted, scalable systems using n8n and GoHighLevel (GHL) to remove manual bottlenecks in clinics, gyms, wellness clubs, and other service businesses.

I don’t just connect apps – every workflow is designed with logging, monitoring, and recovery so it can run reliably in real-world conditions, not just demos.

---

## 🌟 Featured Systems

### 1. Holistic Wellness Club – GHL + n8n Ecosystem 💎  

Stack: GoHighLevel · n8n · JavaScript · WhatsApp API · Google Sheets · Google Calendar

- Business context: Wellness club offering yoga, meditation, retreats, and holistic cooking programs.  
- GoHighLevel (Patient Journey):  
  - Pipelines for Leads → Bookings → Attendance → No-shows / Re-engagement.  
  - Workflows for appointment confirmation, reminders, and post-visit review requests.  
- n8n (Brain & Monitor):  
  - Receives webhooks from GHL (new leads, new bookings, status changes).  
  - Normalizes and logs all events into Google Sheets (as an audit + reporting layer).  
  - Creates additional records (e.g. “booking snapshots”) for analytics or BI later.  
- Resilience & Monitoring:  
  - Dedicated Error Trigger flow that logs any failed step to a separate Errors sheet.  
  - Sends instant alerts to the team via email/Discord when a webhook or API call fails.  
- Impact:  
  - Front-desk manual work on reminders & tracking reduced by ≈70%.  
  - Clear visibility across Calendar / Pipelines / Automations from one place.

[View details →](./holistic-wellness-club)

---

### 2. Clinic Booking System – AI Receptionist for Dental & Medical Clinics 🦷  

Stack: n8n (self-hosted) · OpenAI · WhatsApp / Messenger / Telegram · Google Sheets · Google Calendar

- Replaces manual receptionist chat with an AI assistant.  
- Centralizes all WhatsApp / Messenger / Instagram inquiries into structured rows in Google Sheets.  
- Syncs appointments with Google Calendar, with automatic confirmation and reminder flows.  
- Tracks every inquiry, appointment, and status change for later reporting.  

Impact:  
- More than 90% of initial inquiries handled end-to-end by automation.  
- Typical response time dropped to under 2 minutes instead of waiting for a human reply.

[View details →](./clinic-booking-system)

---

### 3. Gym Lead Management – Trials, Memberships & Follow-Up 🏋️‍♂️  

Stack: n8n · OpenAI · WhatsApp / Instagram / Messenger · Google Sheets · Google Calendar

- Captures all incoming messages (WhatsApp / Instagram / Messenger) and turns them into a structured lead pipeline (Member / Hot / Trial / Lost).  
- Automates trial-class booking and follow-up messages.  
- Eliminates manual data entry into Sheets.  

Impact:  
- Designed to handle 150+ leads/month with full traceability.  
- Automatically sends personalized gym offers to active leads.

[View details →](./gym-lead-management)

---

### 4. Beauty Center Reception Workflow – Multi-Service Booking 💄  

Stack: n8n · OpenAI · WhatsApp · Instagram · Messenger · Google Sheets · Google Calendar

- Centralizes messages from multiple channels into one reception workflow.  
- Suggests service types, books appointments, and syncs them with Calendar.  
- Tracks customers, preferences, and visit history in Sheets.  

Impact:  
- Brings 3+ channels into a single system with automated follow-ups.  
- Reduces missed messages and forgotten bookings across the team.

[View details →](./beauty-center-reception-workflow)

---

### 5. Smart Lead Engine for Marketing Agencies 📈  

Stack: n8n · RSS / External APIs · OpenAI · Slack / Email · Google Sheets or SQL

- Pulls content ideas and topics from RSS feeds/APIs and enriches them with AI.  
- Scores and tags leads/content opportunities based on intent and relevance.  
- Sends alerts to Slack/email whenever high-intent leads or trending topics are detected.
- - Designed as a reusable engine that agencies can plug into different campaigns.

[View details →](./marketing-lead-engine)

---

## 🧩 Additional Private Business Use Cases

Beyond the systems above, I design custom n8n automations for private and field-based businesses, such as:

- HVAC and maintenance companies  
- Home services (cleaning, repairs, technicians)  
- Small agencies and local service providers

Typical patterns:

- Centralising all WhatsApp / Messenger / Instagram / Telegram inquiries into Google Sheets (as a simple CRM).  
- Selecting an available time on Google Calendar to book the appointment.  
- Reminder and follow-up flows so no lead, job, or payment is forgotten.

---

## 🛠 Tech Stack

### Automation & AI
- n8n (self-hosted on VPS)  
- OpenAI / Gemini (conversational flows & decision logic)  
- Custom prompt design, logging, and error handling  

### Messaging Platforms
- WhatsApp Business API  
- Meta Messenger Platform  
- Instagram Direct  
- Telegram Bot API  

### Data & Scheduling
- Google Sheets (CRM, logs, and dashboards)  
- Google Calendar API (scheduling)  
- Webhooks & REST API integrations
- - Basic Python ,and JavaScript fundamentals for data shaping and custom logic

### Infrastructure
- Hostinger VPS (self-hosted n8n via Docker)  
- Logging, retries, and monitoring for production usage

---

## 📍 Where These Workflows Fit

These automations are built for:

- Clinics & Medical Practices – patient booking, reminders, FAQ automation  
- Gyms & Fitness Centers – lead capture, trials, membership retention  
- Beauty Centers & Salons – multi-service booking & customer follow-up  
- Private / Service Businesses – reception automation, lead qualification, job tracking  

---

## 📬 Contact

- LinkedIn: [Khaled Abdelaziz](https://www.linkedin.com/in/khaled-abdelaziz-20b05a393)  
- Email: khaledabdelaziz1330@gmail.com  

---

## 📝 Notes

- Workflow screenshots and documentation are available in each project folder.  
- n8n JSON exports can be shared for technical review or test deployment.  
- All systems are designed with real production constraints in mind:  
  errors, retries, logging, monitoring, and safe handover to humans.
