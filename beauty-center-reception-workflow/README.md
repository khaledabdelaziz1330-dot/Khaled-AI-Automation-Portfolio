# Beauty Center Reception Workflow

Multi-service booking & reception system for beauty centers and salons
(WhatsApp · Instagram · Facebook Messenger)

---

![beauty center workflow](https://github.com/user-attachments/assets/0bcb25cd-e5e2-461d-b64e-ee360597670f)

---

## What This System Does

This workflow acts as a 24/7 digital receptionist for beauty centers and salons.

- Handles all inquiries from WhatsApp / Instagram / Messenger
- Helps clients book services (hair, nails, facial, laser, etc.) with the right specialist
- Manages multiple branches or rooms with time slots
- Stores all client details, preferences, and booking history in Google Sheets
- Sends confirmations, reminders, and follow-up messages automatically

---

## How It Works

1. **Client sends a message on any channel**
   From ad, story, profile button, or saved WhatsApp number.

2. **AI receptionist welcomes and qualifies the request**
   - Asks what service they want (hair, nails, facial, laser, package)
   - Asks preferred day/time and branch (if there are multiple locations)
   - Collects name and phone number

3. **Service & staff selection**
   - Maps requested service to the right category / specialist / room
   - Can apply business rules (e.g. "laser only with Dr. X on Mon/Wed")

4. **Booking & scheduling**
   - Suggests available time windows
   - Confirms the appointment and writes it into Google Calendar
   - Logs all details (service, staff, time, channel) into Google Sheets

5. **Reminders & follow-ups**
   - Sends automatic reminders before the appointment
   - After visit: feedback request, cross-sell or upsell offers, next-session reminder
   - If client did not show up, sends a no-show follow-up

---

## Stack

| Layer | Tools |
|---|---|
| **Orchestration** | n8n (self-hosted on VPS) |
| **AI** | OpenAI (conversational AI & intent detection) |
| **Channels** | WhatsApp, Instagram, Messenger |
| **Data** | Google Sheets (client database, visit history, service log) |
| **Scheduling** | Google Calendar (appointment scheduling, staff timetable) |

---

## Impact

- All DMs from ads & stories are **captured and structured** instead of lost in chat
- Front desk workload reduced by handling repetitive questions automatically
- Fewer no-shows thanks to reminders and clear confirmations
- Better lifetime value via follow-ups and targeted offers

---

## Notes

- Services, prices, and packages are fully custom per beauty center
- Can support multiple branches with separate calendars
- Easy to start with one channel (e.g. WhatsApp) and add more later
