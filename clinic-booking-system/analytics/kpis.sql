-- Healthcare AI Receptionist — KPI queries
--
-- The metrics in PERFORMANCE.md ("Outcome Metrics"), defined precisely in SQL.
-- kpi_report.py implements the same definitions in Python; the tests check that both agree.
-- Portable: PostgreSQL 13+ and SQLite 3.35+. Each query starts with a "-- name:" line.


-- name: automation_rate
-- Share of conversations resolved without a single staff message ("inquiries handled without staff").
SELECT
    COUNT(*)                                                            AS conversations,
    SUM(CASE WHEN staff_messages = 0 THEN 1 ELSE 0 END)                 AS handled_by_ai_only,
    ROUND(100.0 * SUM(CASE WHEN staff_messages = 0 THEN 1 ELSE 0 END)
          / NULLIF(COUNT(*), 0), 1)                                     AS automation_rate_pct
FROM (
    SELECT c.conversation_id,
           SUM(CASE WHEN m.sender = 'staff' THEN 1 ELSE 0 END) AS staff_messages
    FROM conversations AS c
    LEFT JOIN messages AS m ON m.conversation_id = c.conversation_id
    GROUP BY c.conversation_id
) AS per_conversation;


-- name: booking_conversion
-- Conversations that asked to book and ended with a confirmed appointment (booked, attended or no-show).
SELECT
    COUNT(*)                                                            AS booking_conversations,
    SUM(CASE WHEN converted THEN 1 ELSE 0 END)                          AS converted,
    ROUND(100.0 * SUM(CASE WHEN converted THEN 1 ELSE 0 END)
          / NULLIF(COUNT(*), 0), 1)                                     AS booking_conversion_pct
FROM (
    SELECT c.conversation_id,
           EXISTS (
               SELECT 1 FROM appointments AS a
               WHERE a.conversation_id = c.conversation_id
                 AND a.status IN ('booked', 'attended', 'no_show')
           ) AS converted
    FROM conversations AS c
    WHERE EXISTS (
        SELECT 1 FROM messages AS m
        WHERE m.conversation_id = c.conversation_id AND m.intent = 'BOOKING_REQUEST'
    )
) AS booking_requests;


-- name: no_show_rate
-- No-show rate of completed appointments, with and without a reminder.
SELECT
    CASE WHEN reminder_sent THEN 'with reminder' ELSE 'without reminder' END AS reminder,
    COUNT(*)                                                            AS completed_appointments,
    SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END)                 AS no_shows,
    ROUND(100.0 * SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END)
          / NULLIF(COUNT(*), 0), 1)                                     AS no_show_rate_pct
FROM appointments
WHERE status IN ('attended', 'no_show')
GROUP BY reminder_sent
ORDER BY reminder;


-- name: bookings_by_channel
-- Appointments (excluding cancellations) by the channel the patient booked through.
SELECT
    c.channel,
    COUNT(*) AS appointments
FROM appointments AS a
JOIN conversations AS c ON c.conversation_id = a.conversation_id
WHERE a.status <> 'cancelled'
GROUP BY c.channel
ORDER BY appointments DESC, c.channel;
