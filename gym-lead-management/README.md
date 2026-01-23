# Gym Lead Management System

Multi-channel lead capture & trial booking workflow for gyms and fitness centers  
(WhatsApp · Instagram · Facebook Messenger · Telegram)

---
![Gym workflow overview](./gym-workflow.jpg)


## 🏋️‍♂️ What this system does

This workflow turns all gym inquiries from **WhatsApp / Instagram / Messenger / Telegram** into a
structured lead pipeline and automated trial booking system.

It:

- Captures every inquiry from ads, posts, or word-of-mouth.
- Qualifies leads (goals, experience level, preferred time).
- Books free trials or paid first sessions.
- Tracks each lead’s status in Google Sheets (New / Hot / Warm / Trial booked / Member).
- Sends reminders and follow-up messages so no lead is forgotten.

---

## 🔁 Lead journey (step by step)

1. **Lead sends a message on any channel**  
   Usually from a paid ad, story, or profile button.

2. **AI assistant replies instantly**  
   - Welcomes them and asks a few short questions  
   - Collects: name, phone, fitness goal, preferred time, branch (if needed)

3. **Lead qualification & logging**  
   - Saves all answers in **Google Sheets**  
   - Assigns a status (New / Hot / Warm / Trial booked)  
   - This sheet becomes a simple **CRM** for the gym team.

4. **Trial booking**  
   - Suggests available trial times (morning / evening windows or exact slots)  
   - Confirms the visit and writes it into **Google Calendar**  
   - Sends the trial details (time, location, what to bring).

5. **Reminders & follow-up**  
   - Sends an automatic reminder before the trial.  
   - After the visit, sends a follow-up message and can push for **membership sign-up**.  
   - If the lead didn’t show up, sends a gentle re-engagement message.

---

## 🧱 Stack

- **n8n** (self-hosted on VPS) – main orchestration  
- **OpenAI** – AI replies & intent detection  
- **WhatsApp / Instagram / Messenger / Telegram** – entry channels  
- **Google Sheets** – lead pipeline (statuses, notes, contact info)  
- **Google Calendar** – trial & session scheduling

---

## 📊 Impact (designed goals)

- All ad leads are **captured & logged** instead of getting lost in chats.  
- Sales team gets a **clean sheet** with status for each lead.  
- Trial bookings & reminders run automatically.  
- Higher conversion from **lead → trial → member**, with less manual work.

---

## 📝 Notes

- Status names, questions, and trial rules are fully configurable per gym.  
- Can start with WhatsApp only, then expand to more channels when needed.  
- Built for real gyms: includes logging, error handling, and handover to human staff when required.
