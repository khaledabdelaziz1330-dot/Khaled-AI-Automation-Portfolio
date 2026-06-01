# Sample Conversations

Real conversation patterns from the clinic AI receptionist. Patient identities and clinic-specific details are anonymized; conversation structure and AI behavior are representative of actual production traffic.

---

## Example 1 — Standard booking flow (English, WhatsApp)

**16:42** — Patient (Sarah M., new patient)
> Hi, I'd like to book a cleaning appointment please

**16:42** — AI Receptionist
> Hi Sarah! Happy to help you book a cleaning. Could you tell me what day works best for you, and do you have a preferred time (morning, afternoon, or evening)?

**16:43** — Patient
> Maybe thursday afternoon if you have anything

**16:43** — AI Receptionist
> Let me check Thursday afternoon for you... I have these times available:
>
> • Thursday, Mar 14 — 2:30 PM
> • Thursday, Mar 14 — 3:00 PM
> • Thursday, Mar 14 — 4:30 PM
>
> Which one works for you?

**16:45** — Patient
> 3pm works

**16:45** — AI Receptionist
> Perfect! I've booked your cleaning appointment for Thursday, March 14 at 3:00 PM. You'll receive a reminder 24 hours before, and another 2 hours before. See you Thursday!

**Notes on this conversation:**
- Total elapsed time: ~3 minutes
- 4 AI turns (typical for booking flow)
- AI never offered a time it hadn't verified in Google Calendar
- Confirmation message includes specific reminder schedule
- Estimated cost: $0.012

---

## Example 2 — Bilingual conversation (Arabic + English, WhatsApp)

**10:18** — Patient (Mohamed A., returning patient)
> السلام عليكم. ممكن حجز مع د. أحمد؟

**10:18** — AI Receptionist
> وعليكم السلام محمد! أكيد، عاوز حجز لكشف أو علاج معين؟ وتفضل إيه يوم وميعاد؟

**10:19** — Patient
> Cleaning بس. tomorrow morning if possible

**10:19** — AI Receptionist
> تمام! بكره الصبح عندي المواعيد دي مع د. أحمد:
>
> • بكره (الاتنين 11 مارس) — 9:00 صباحاً
> • بكره — 10:30 صباحاً
> • بكره — 11:30 صباحاً
>
> أي ميعاد يناسبك؟

**10:21** — Patient
> 10:30 perfect

**10:21** — AI Receptionist
> تم الحجز! 🦷
>
> الموعد: الاتنين 11 مارس - 10:30 صباحاً
> الدكتور: د. أحمد
> النوع: تنظيف
>
> هتوصلك رسالة تذكير قبل الموعد بـ 24 ساعة و كمان قبله بساعتين.

**Notes on this conversation:**
- Patient mixed Arabic and English; AI matched the dominant language
- AI correctly recognized "Cleaning" as the requested service
- Used colloquial Egyptian Arabic ("تمام" not "حسناً"), matching patient's tone
- Confirmation includes structured details
- Estimated cost: $0.014

---

## Example 3 — Out-of-scope handoff (English, Instagram DM)

**21:33** — Patient (anonymous DM)
> hi can the dentist remove my wisdom tooth tonight i'm in pain

**21:33** — AI Receptionist
> I'm so sorry you're in pain. For urgent same-day emergency care, please call our emergency line directly at +20-XXX-XXX-XXXX. The team can advise on next steps right away.
>
> If you'd like to book a non-emergency wisdom tooth consultation for a different day, I can help with that too.

**21:35** — Patient
> ok i'll call thanks

**21:35** — AI Receptionist
> Hope you feel better soon. Don't hesitate to message back if you need to book a follow-up.

**Notes on this conversation:**
- AI correctly identified this as urgent (high urgency in extraction)
- Did NOT attempt to book — routed to emergency line
- Did NOT make medical claims
- Empathetic tone, brief
- Estimated cost: $0.003

---

## Example 4 — Edge case: AI doesn't know

**14:08** — Patient (John K., new patient)
> Do you accept Allianz insurance?

**14:08** — AI Receptionist
> Great question — let me connect you with our team for the most accurate answer on insurance acceptance. I'll flag your message to the office now, and someone will reply within an hour during business hours.

**14:09** — System
> [Conversation flagged for human follow-up. Slack alert sent to clinic team.]

**14:42** — Clinic team member
> Hi John! Yes, we accept Allianz. Just bring your insurance card when you come in. Want me to book you a cleaning or consultation?

**Notes on this conversation:**
- AI did NOT make up an answer about insurance (a hallucination risk)
- Cleanly escalated to human within seconds
- Team responded within the 1-hour SLA
- This is the "I don't know" pattern in action

---

## Patterns visible across these conversations

1. **AI never invents data** — slots are always real, prices are never guessed, insurance answers are never fabricated
2. **Language matches the patient** — Arabic dialect when patient writes in Arabic dialect, English when in English, mixed when mixed
3. **Urgent cases escalate immediately** — emergency, pain, complications never go through normal booking flow
4. **Confirmation messages are structured** — patients can re-read them clearly
5. **Cost per conversation is low** — typical $0.003-0.014, fitting within the $50-90/month cost target for ~5,000-15,000 conversations/month
