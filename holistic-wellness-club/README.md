# Holistic Wellness Club – GHL + n8n Ecosystem 💎

End-to-end automation system for a wellness club offering yoga, meditation, retreats, and holistic cooking programs.  
This project combines GoHighLevel (GHL) for the client journey and n8n as the automation “brain” and monitoring layer.

---

## 1. Business Context & Goals

Business type: Holistic wellness club (classes, retreats, and cooking workshops).

Main problems we wanted to solve:

- Manual handling of bookings, reminders, and rescheduling over WhatsApp.
- Front-desk wasting time updating calendars and tracking who actually attended.
- No proper logs or reporting on leads, bookings, no-shows, and reviews.

Goals:

- Centralize all bookings into one calendar & one pipeline.
- Reduce front-desk manual work on reminders & tracking by ~70%.
- Build a system that can be monitored, debugged, and extended – not just a demo.

---

## 2. Tech Stack

- Automation & Logic
  - n8n (self-hosted on VPS, Docker)
  - JavaScript expressions inside n8n nodes for data shaping & routing
- CRM & Client Journey
  - GoHighLevel – pipelines, workflows, calendars, forms, contacts
- Messaging & Integrations
  - WhatsApp API (via provider)
  - Google Sheets – logging, reporting, and lightweight CRM
  - Google Calendar – scheduling and resource management

---

## 3. High-Level Architecture

1. Lead enters the system
   - User visits the Wellness Club website (GHL site) and fills a form / booking widget.
   - GHL creates a Contact + Opportunity and drops it into the relevant Pipeline stage.

2. GoHighLevel handles the “visible” journey
   - Pipelines for: New lead → Booking confirmed → Attended → No-show → Re-engagement.
   - Workflows send:
     - Confirmation messages
     - Reminder emails/SMS
     - Post-visit review requests

3. n8n works as the “Brain & Monitor”
   - Receives webhooks from GHL whenever:
     - A lead is created
     - A booking is confirmed/updated
     - Status changes (attended / no-show / cancelled)
   - Normalizes the payload and:
     - Logs it into Google Sheets as a structured event
     - Creates booking snapshots for reporting/BI
     - Triggers additional internal automations (e.g. error alerts)

4. Data & Reporting Layer
   - Google Sheets used as:
     - Audit log of all events
     - Summary dashboards (by date, service type, attendance, etc.)
   - Separate Errors sheet to track any failed calls or unexpected responses.

---

## 4. GoHighLevel Setup (Pipelines, Calendars, Workflows)

### 4.1 Pipelines

- Wellness Club – Leads
  - Stages: New Lead, Hot Lead, Cold Lead
  - Used for early qualification before booking.

- Holistic Services – Bookings
  - Stages: Appointment confirmed, Attended / feedback sent, No-shows, Cancelled
  - Each card is linked to a specific class / session in the calendar.

### 4.2 Calendars

- Dedicated group calendar for the Wellness Club:
  - Shows all upcoming classes and bookings in Month View.
  - Used by staff to quickly see occupancy and availability.

### 4.3 GHL Workflows (non-exhaustive)

- Appointment Confirmation + Reminders
  - Trigger: customer books an appointment.
  - Actions:
    - Remove from “New Lead” funnel.
    - Update Opportunity to booking stage.
    - Send confirmation email immediately.
    - Send 24-hr reminder email.
    - Send 2-hr reminder email + SMS.

- Send Review Request
  - Trigger: appointment marked as showed / attended.
  - Wait 2 days → send review request SMS → send review request email.

- Lead Nurture / Cold Lead Nurture / No-Show Nurture
  - Conditional sequences to re-engage:
    - People who never booked.
    - People who missed their appointment.
    - Former clients who went inactive.

---

## 5. n8n Workflows in This Project

> All workflows are designed with logging, retries, and error paths so they can run in production.

### 5.1 Booking Event Logger

- Trigger: Webhook from GHL on booking/appointment events.
- Main steps:
  - Validate payload & normalize fields (service, date, contact, status).
  - Append row into Bookings_Log sheet.
- Create/refresh a “snapshot” row for that booking (latest status).
  - If something important is missing → branch into an error path.

### 5.2 Lead Event Logger

- Trigger: Webhook when a new lead/opportunity is created or updated.
- Main steps:
  - Parse lead source, funnel entry point, and tags.
  - Insert/update data in Leads_Log sheet.
  - Optionally notify Slack/Discord if it’s tagged as High Intent.

### 5.3 Error Trigger & Notifications

- Trigger: Called from other workflows whenever:
  - An API call fails
  - A required field is empty
  - A Sheet operation throws an error
- Actions:
  - Append a row to the Errors sheet with:
    - Workflow name
    - Node name
    - Error message
    - Raw payload (if needed)
  - Send alert via email/Discord with a short summary + link to the log.

---

## 6. Data Model (Google Sheets)

Typical tabs used:

- Bookings_Log – one row per booking event (history).
- Bookings_Snapshot – one row per active booking with latest status.
- Leads_Log – timeline of lead creation and changes.
- Errors – centralized error log.
- (Optional) KPIs – summary formulas / pivot tables for reporting.

---

## 7. Impact & Outcomes

- Designed to reduce front-desk manual work on tracking and reminders by ≈70%.
- Provides a single source of truth across:
  - GHL Pipelines  
  - Calendar bookings  
  - n8n logs & Sheets
- Makes it easy to:
  - See which campaigns brought which leads.
  - Track attendance, no-shows, and re-engagement.
  - Debug issues quickly using the error log.

---

## 8. Re-use & Extension

This architecture can be reused for:

- Other wellness/fitness businesses (yoga studios, gyms, retreats).
- Multi-service clinics with different calendars.
- Any service business that needs:
  - Multi-channel booking
  - Structured logging
  - Reliable reminders & review requests.

---

## 9. Screenshots

Screenshots for this project are stored in: ./screenshots/

Suggested files:

- screenshots/pipelines-overview.png – GHL pipelines for leads & bookings.  
- screenshots/calendar-bookings.png – month view of class bookings.  
- screenshots/workflows-automation.png – main GHL workflows.  
- screenshots/n8n-flows.png – n8n booking/logging + error trigger workflows.
