# AI Automation Engineer | Health-Tech Specialist – Automation Portfolio

Agentic Workflows & Production-Ready Systems for Service Businesses

---

## 🎯 Profile

I bridge the gap between clinical expertise (BDS) and advanced automation.  
I specialize in building self-hosted, scalable systems using n8n and GoHighLevel (GHL) to remove manual bottlenecks in clinics, gyms, wellness clubs, and other service businesses.

I don’t just connect apps – every workflow is designed with logging, monitoring, and recovery so it can run reliably in real-world conditions, not just demos.

---

## 🌟 Featured Systems

### 1. Holistic Wellness Club – GHL + n8n Ecosystem 💎

Stack: GoHighLevel · n8n · JavaScript · WhatsApp API · Google Sheets · Google Calendar  

- Business context: Wellness club offering yoga, meditation, retreats, and holistic cooking programs.
- GoHighLevel:
  - Pipelines for Leads → Bookings → Attendance → No-shows / Re-engagement.
  - Workflows for appointment confirmation, reminders, and post-visit review requests.
- n8n (Brain & Monitor):
  - Receives webhooks from GHL (new leads, new bookings, status changes).
  - Normalizes and logs all events into Google Sheets (as an audit + reporting layer).
  - Creates additional records (e.g., “booking snapshots”) for analytics or BI later.
- Resilience & Monitoring:
  - Dedicated Error Trigger flow that logs any failed step to a separate “Errors” sheet.
  - Sends instant alerts to the team via email/Discord when a webhook or API call fails.
- Impact:
  - Front-desk manual work on reminders & tracking reduced by ≈70%.
  - Clear visibility across Calendar / Pipelines / Automations from one place.

---

### 2. Clinic Booking System – AI Receptionist for Dental & Medical Clinics 🦷

Stack: n8n (self-hosted) · OpenAI · WhatsApp / Messenger / Telegram · Google Sheets · Google Calendar  

- Replaces manual receptionist chat with an AI assistant that handles FAQs, booking, rescheduling, and basic triage questions.
- Centralizes all WhatsApp / Messenger / Instagram inquiries into structured rows in Google Sheets.
- Syncs appointments with Google Calendar, with automatic confirmation and reminder flows.
- Tracks every inquiry, appointment, and status change for later reporting.
- Impact:
  - More than 90% of initial inquiries handled end-to-end by automation.
  - Typical response time dropped to under 2 minutes instead of waiting for a human reply.

---

### 3. Gym Lead Management – Trials, Memberships & Follow-Up 🏋️‍♂️

Stack: n8n · OpenAI · WhatsApp / Instagram / Messenger · Google Sheets · Google Calendar  

- Captures all incoming messages (WhatsApp / Instagram / Messenger) and turns them into a lead pipeline (Member / Hot / Trial booked).
- Automates trial-class booking, reminders, and follow-up messages after the visit.
- Logs all leads and interactions into Google Sheets for the sales team.
- Designed to handle 150+ leads/month with full traceability for each lead.
- Automatically sends targeted offers to leads based on their status (Hot / Trial / Inactive).

---

### 4. Beauty Center Reception Workflow – Multi-Service Booking 💄

Stack: n8n · OpenAI · WhatsApp / Instagram / Messenger · Google Sheets · Google Calendar  

- Combines messages from multiple channels into one reception workflow.
- Suggests services, books appointments, and syncs them with Google Calendar.
- Tracks visits, services received, and client history inside Google Sheets.
- Merges multiple channels into one clear system with automated follow-ups for no-shows and inactive clients.

---

### 5. Smart Content & Lead Engine for Marketing Agencies 📈

Stack: n8n · RSS / APIs · OpenAI · Slack / Email · Google Sheets  
- Sends alerts to Slack / Email when a high-intent lead or topic appears and needs action from the team.
- Designed to plug into existing agency CRMs or GHL to push qualified leads directly into pipelines.

---

## 🔁 Additional Private Business Use Cases

Beyond the featured systems, I’ve designed custom n8n automations for:

- HVAC and maintenance companies – job intake, technician scheduling, and follow-ups.  
- Home services (cleaning, repairs, technicians) – centralized WhatsApp inbox → Sheets → Calendar.  
- Small agencies and local service providers – reception automation, lead qualification, and job tracking.

Typical patterns:

- Centralizing all WhatsApp / Messenger / Instagram / Telegram inquiries into Google Sheets as a lightweight CRM.
- Letting clients self-schedule via Google Calendar / booking links.
- Reminder & recovery flows so no lead, job, or payment is forgotten.

---

## 🛠 Tech Stack

### Automation & AI
- n8n (self-hosted on VPS) – multi-step workflows, JS code nodes, error handling & retries.  
- GoHighLevel (GHL) – CRM, pipelines, workflows, and AI agents for conversations.  
- OpenAI / Gemini – conversational flows, routing logic, and content generation.  
- Custom prompt design, logging, and monitoring-first architecture.

### Messaging Platforms
- WhatsApp Business API (via providers)  
- Meta Messenger Platform  
- Instagram Direct  
- Telegram Bot API  

### Data & Scheduling
- Google Sheets – CRM, logs, and reporting dashboards  
- Google Calendar API – scheduling & availability  
- Webhooks & REST API integrations  
- Basic Python, SQL, and JavaScript fundamentals for data shaping and custom logic

### Infrastructure
- Hostinger VPS (self-hosted n8n) with Docker  
- Structured logging, retries, and monitoring for production usage  
- Clear handover paths to humans when automation cannot safely decide

---

## 📍 Where These Workflows Fit

These automations are built for:

- Clinics & Medical Practices – patient booking, reminders, FAQ & reception automation  
- Gyms & Fitness Centers – lead capture, trials, membership retention  
- Beauty Centers & Salons – multi-service booking & customer follow-up  
- Wellness Clubs & Retreats – class booking, retreat scheduling, and feedback loops  
- Private / Service Businesses – reception automation, lead qualification, and job tracking  

---

## 📂 Repository Structure

Each main system lives in its own folder (for example):

- clinic-booking-system/ – Clinic AI receptionist & booking flows  
- gym-lead-management/ – Lead pipeline & follow-ups for gyms  
- beauty-center-reception-workflow/ – Multi-service booking for salons  
- wellness-club-ghl-system/ – Holistic Wellness Club (GHL + n8n)  
- marketing-content-engine/ – Smart content & lead engine for agencies  

Inside each folder you’ll typically find:

- README.md – business context, architecture, and key flows  
- *.jpg / *.png – workflow screenshots from n8n or GHL  
- (Optional) export.json – n8n workflow export for technical review

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
- Pulls topics and raw content ideas from RSS feeds, blogs, or marketing APIs.
- Uses OpenAI to generate draft posts, email hooks, or article outlines ready for human review.
- Scores topics by relevancy and intent (high-intent vs low-intent) and stores them in a Google Sheets dashboard.
