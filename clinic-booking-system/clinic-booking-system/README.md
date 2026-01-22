# Clinic Booking System

Multi-channel booking and reception workflow for dental & medical clinics  
(WhatsApp · Instagram · Facebook Messenger · Telegram)

---

## 🩺 What this system does

This workflow replaces the manual receptionist on **WhatsApp / Instagram / Messenger / Telegram** with an AI assistant that:

- Answers FAQs (prices, working hours, location, services…)
- Collects patient details in a structured way
- Checks available time slots
- Books, reschedules, and cancels appointments
- Sends automatic reminder messages before the visit
- Logs every single conversation and booking into Google Sheets

The goal is simple: **no missed inquiries, faster replies, and fewer no-shows — across all channels, not just WhatsApp.**

---

## 🔁 Patient journey (step by step)

1. **Patient sends a message on any channel**  
   WhatsApp / Instagram DM / Facebook Messenger / Telegram.

2. **AI receptionist replies instantly**  
   - Greets the patient in a friendly tone  
   - Answers their question using the clinic’s rules (services, prices, working hours)  
   - If they’re interested, it starts a short booking flow

3. **Lead & booking capture**  
   The workflow asks for:
   - Full name  
   - Phone number (if different)  
   - Channel they came from  
   - Service they want  
   - Preferred date & time  

   All answers are **stored in Google Sheets** in a clean, structured row (one sheet = unified inbox).

4. **Availability & confirmation**  
   - Checks available slots in **Google Calendar**  
   - Suggests the nearest free times  
   - Confirms the chosen slot and writes it to Calendar

5. **Reminders & follow-up**  
   - Sends an automatic reminder on the **same channel** before the appointment  
   - Can send a simple follow-up (“How was your visit?” / “Need to book your next cleaning?”)

---

## 🧱 Stack

- **n8n** (self-hosted on VPS) – main orchestration
- **OpenAI** – AI assistant replies & intent detection
- **WhatsApp Business / Instagram / Messenger / Telegram** – patient entry channels
- **Google Sheets** – patient & lead database (multi-channel log)
- **Google Calendar** – appointment scheduling

---

## 📊 Impact (designed goals)

- **90%+** of incoming messages handled automatically across all channels  
- **Response time**: from hours → under **2 minutes**  
- **Missed leads**: every chat is logged, even if the patient doesn’t book  
- **Reception workload**: repetitive Q&A and basic bookings removed from the staff

---

## 📝 Notes

- The workflow is built to be adapted to any dental or medical clinic (services, prices, and rules are configurable).  
- Works with one or multiple channels depending on the clinic’s needs (can start with WhatsApp only, then add others).  
- Error handling, fallbacks to human staff, and logging are included for real-world use.

![Clinic workflow](./clinic%20workflow.jpg)
