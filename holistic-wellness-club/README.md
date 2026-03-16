# Holistic Wellness Club – GHL + n8n Ecosystem

End-to-end automation system for a wellness club offering yoga, meditation, retreats, and holistic cooking programs
(GoHighLevel · n8n · WhatsApp · Google Sheets · Google Calendar)

---

![wellness club screenshots](screenshots/photo_1_2026-02-20_08-16-52.jpg)

---

## What This System Does

A comprehensive automation system that combines **GoHighLevel (GHL)** for the client journey and **n8n** as the automation brain and monitoring layer. Built for a holistic wellness club that needed to eliminate manual handling of bookings, reminders, and tracking.

**Problems solved:**

- Manual handling of bookings, reminders, and rescheduling over WhatsApp
- Front-desk wasting time updating calendars and tracking attendance
- No proper logs or reporting on leads, bookings, no-shows, and reviews

---

## How It Works

### GoHighLevel (Client Journey)

**Pipelines:**
- **Wellness Club – Leads:** New Lead → Hot Lead → Cold Lead (early qualification)
- **Holistic Services – Bookings:** Appointment confirmed → Attended → No-shows → Cancelled

**Workflows:**
- **Appointment Confirmation + Reminders** — confirmation email → 24-hr reminder → 2-hr reminder (email + SMS)
- **Review Request** — 2 days after visit → review request SMS → review request email
- **Lead Nurture / No-Show Nurture** — re-engagement sequences for people who never booked, missed appointments, or went inactive

### n8n (Brain & Monitor)

1. **Booking Event Logger** — receives webhooks from GHL on booking events, validates and normalizes fields, appends to Bookings_Log sheet, creates booking snapshots
2. **Lead Event Logger** — parses lead source, funnel entry point, and tags, updates Leads_Log sheet, optionally notifies Slack/Discord for high-intent leads
3. **Error Trigger & Notifications** — catches API failures, empty fields, and Sheet errors, logs to Errors sheet, sends alerts via email/Discord

### Data Layer (Google Sheets)

- **Bookings_Log** — one row per booking event (full history)
- **Bookings_Snapshot** — one row per active booking with latest status
- **Leads_Log** — timeline of lead creation and changes
- **Errors** — centralized error log
- **KPIs** — summary formulas and pivot tables for reporting

---

## Stack

| Layer | Tools |
|---|---|
| **CRM & Journeys** | GoHighLevel (pipelines, workflows, calendars, forms) |
| **Orchestration** | n8n (self-hosted on VPS via Docker) |
| **Logic** | JavaScript (data shaping & routing inside n8n) |
| **Messaging** | WhatsApp API (via provider) |
| **Data** | Google Sheets (logging, reporting, lightweight CRM) |
| **Scheduling** | Google Calendar (resource management) |
| **Alerts** | Email / Discord (error notifications) |

---

## Impact

- Front-desk manual work on reminders & tracking reduced by **~70%**
- Single source of truth across GHL Pipelines, Calendar bookings, and n8n logs
- Clear visibility into which campaigns brought which leads
- Easy tracking of attendance, no-shows, and re-engagement
- Quick debugging using the centralized error log

---

## Screenshots

Screenshots for this project are stored in `./screenshots/`.

> All names, bookings, and data shown are test/demo data only and do not represent real people or businesses.

---

## Notes

- This architecture can be reused for other wellness/fitness businesses, multi-service clinics, or any service business needing multi-channel booking with structured logging
- All workflows are designed with logging, retries, and error paths for production use
- The GHL + n8n combination gives both a user-friendly CRM interface and powerful backend automation
