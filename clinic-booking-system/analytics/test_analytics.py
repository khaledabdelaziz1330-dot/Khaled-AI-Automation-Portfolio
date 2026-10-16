"""Tests for the clinic KPI analytics.

The key test loads the sample export into a real SQL database (SQLite, in memory), runs kpis.sql,
and checks that the SQL answers match kpi_report.py — two independent implementations, one result.

Run:  python -m unittest discover -s clinic-booking-system/analytics -v
"""

import io
import re
import sqlite3
import unittest
from contextlib import redirect_stdout
from pathlib import Path

import kpi_report

HERE = Path(__file__).parent
SAMPLE = HERE / "sample_data"


def load_queries() -> dict[str, str]:
    """Split kpis.sql into {name: query} using its '-- name:' markers."""
    text = (HERE / "kpis.sql").read_text(encoding="utf-8")
    parts = re.split(r"^-- name: (\w+)\s*$", text, flags=re.MULTILINE)
    return {name: query.strip() for name, query in zip(parts[1::2], parts[2::2])}


def build_database(data: dict) -> sqlite3.Connection:
    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys = ON")
    db.executescript((HERE / "schema.sql").read_text(encoding="utf-8"))

    first_seen = {}
    for c in data["conversations"]:
        key = (c["channel"], c["user_id"])
        first_seen[key] = min(first_seen.get(key, c["started_at"]), c["started_at"])
    db.executemany("INSERT INTO patients (channel, user_id, first_seen_at) VALUES (?, ?, ?)",
                   [(ch, user, seen) for (ch, user), seen in first_seen.items()])
    db.executemany("INSERT INTO conversations VALUES (:conversation_id, :channel, :user_id, :started_at)",
                   data["conversations"])
    db.executemany(
        "INSERT INTO messages (channel, channel_message_id, conversation_id, sent_at, direction, sender, intent, body) "
        "VALUES (:channel, :channel_message_id, :conversation_id, :sent_at, :direction, :sender, :intent, :body)",
        [{**m, "intent": m["intent"] or None, "body": m["body"] or None} for m in data["messages"]],
    )
    db.executemany(
        "INSERT INTO appointments VALUES (:appointment_id, :conversation_id, :service, :start_at, :status, :reminder_sent)",
        [{**a, "reminder_sent": kpi_report.is_true(a["reminder_sent"])} for a in data["appointments"]],
    )
    return db


def run(db: sqlite3.Connection, query: str) -> list[dict]:
    cursor = db.execute(query)
    columns = [d[0] for d in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


class KpiReportTest(unittest.TestCase):
    def setUp(self):
        self.data = kpi_report.load_export(SAMPLE)
        self.kpis = kpi_report.compute_kpis(self.data)

    def test_kpis_match_a_hand_calculation(self):
        k = self.kpis
        self.assertEqual(k["conversations"], 16)
        self.assertEqual(k["automation_rate_pct"], 87.5)  # 14 of 16 had no staff message
        self.assertEqual(k["first_response_p50_s"], 3)
        self.assertEqual(k["first_response_p95_s"], 118)
        self.assertEqual(k["replied_within_2_min_pct"], 100)
        self.assertEqual((k["converted"], k["booking_conversations"], k["booking_conversion_pct"]), (7, 9, 77.8))
        self.assertEqual(k["no_show"]["with reminder"]["no_show_rate_pct"], 25)
        self.assertEqual(k["no_show"]["without reminder"]["no_show_rate_pct"], 50)
        self.assertEqual(k["bookings_by_channel"], {"whatsapp": 4, "instagram": 1, "messenger": 1, "telegram": 1})

    def test_slow_replies_count_against_the_two_minute_commitment(self):
        data = {
            "conversations": [{"conversation_id": "x1", "channel": "whatsapp"}, {"conversation_id": "x2", "channel": "whatsapp"}],
            "messages": [
                {"conversation_id": "x1", "sent_at": "2026-01-05T09:00:00Z", "direction": "inbound", "sender": "patient", "intent": "FAQ"},
                {"conversation_id": "x1", "sent_at": "2026-01-05T09:00:04Z", "direction": "outbound", "sender": "ai", "intent": ""},
                {"conversation_id": "x2", "sent_at": "2026-01-05T10:00:00Z", "direction": "inbound", "sender": "patient", "intent": "FAQ"},
                {"conversation_id": "x2", "sent_at": "2026-01-05T10:02:30Z", "direction": "outbound", "sender": "staff", "intent": ""},
            ],
            "appointments": [],
        }
        k = kpi_report.compute_kpis(data)
        self.assertEqual(k["replied_within_2_min_pct"], 50)
        self.assertEqual(k["first_response_p95_s"], 150)
        self.assertEqual(k["automation_rate_pct"], 50)  # x2 was answered by staff

    def test_percentile_uses_nearest_rank(self):
        values = list(range(1, 21))
        self.assertEqual(kpi_report.percentile(values, 50), 10)
        self.assertEqual(kpi_report.percentile(values, 95), 19)
        self.assertIsNone(kpi_report.percentile([], 95))

    def test_rates_round_half_up_like_sql(self):
        self.assertEqual(kpi_report.rate(1, 8), 12.5)
        self.assertEqual(kpi_report.rate(15, 16), 93.8)  # 93.75 -> 93.8, not banker's rounding
        self.assertIsNone(kpi_report.rate(0, 0))

    def test_report_renders(self):
        output = io.StringIO()
        with redirect_stdout(output):
            kpi_report.main(["kpi_report.py", str(SAMPLE)])
        self.assertIn("| Automation rate (no staff message) | 87.5% |", output.getvalue())


class SqlMatchesPythonTest(unittest.TestCase):
    def setUp(self):
        self.data = kpi_report.load_export(SAMPLE)
        self.kpis = kpi_report.compute_kpis(self.data)
        self.queries = load_queries()
        self.db = build_database(self.data)

    def tearDown(self):
        self.db.close()

    def test_every_query_is_covered(self):
        self.assertEqual(set(self.queries), {"automation_rate", "booking_conversion", "no_show_rate", "bookings_by_channel"})

    def test_automation_rate(self):
        [row] = run(self.db, self.queries["automation_rate"])
        self.assertEqual(row["conversations"], self.kpis["conversations"])
        self.assertEqual(row["handled_by_ai_only"], self.kpis["handled_by_ai_only"])
        self.assertEqual(row["automation_rate_pct"], self.kpis["automation_rate_pct"])

    def test_booking_conversion(self):
        [row] = run(self.db, self.queries["booking_conversion"])
        self.assertEqual(row["booking_conversations"], self.kpis["booking_conversations"])
        self.assertEqual(row["converted"], self.kpis["converted"])
        self.assertEqual(row["booking_conversion_pct"], self.kpis["booking_conversion_pct"])

    def test_no_show_rate(self):
        rows = {r["reminder"]: r for r in run(self.db, self.queries["no_show_rate"])}
        for label, expected in self.kpis["no_show"].items():
            if expected["completed_appointments"]:
                self.assertEqual(rows[label]["completed_appointments"], expected["completed_appointments"])
                self.assertEqual(rows[label]["no_shows"], expected["no_shows"])
                self.assertEqual(rows[label]["no_show_rate_pct"], expected["no_show_rate_pct"])

    def test_bookings_by_channel(self):
        rows = run(self.db, self.queries["bookings_by_channel"])
        self.assertEqual({r["channel"]: r["appointments"] for r in rows}, self.kpis["bookings_by_channel"])
        self.assertEqual([r["channel"] for r in rows], list(self.kpis["bookings_by_channel"]))


class SchemaGuardsTest(unittest.TestCase):
    def setUp(self):
        self.db = build_database(kpi_report.load_export(SAMPLE))

    def tearDown(self):
        self.db.close()

    def insert_message(self, **overrides):
        row = {"channel": "whatsapp", "channel_message_id": "wamid.NEW1", "conversation_id": "c01",
               "sent_at": "2026-03-02T08:00:00Z", "direction": "inbound", "sender": "patient", "intent": "FAQ", "body": "hi"}
        row.update(overrides)
        self.db.execute("INSERT INTO messages VALUES (:channel, :channel_message_id, :conversation_id, :sent_at, "
                        ":direction, :sender, :intent, :body)", row)

    def test_a_webhook_retry_cannot_store_the_same_message_twice(self):
        self.insert_message()
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert_message()

    def test_rejects_impossible_messages(self):
        for bad in ({"sender": "ai"},  # an inbound message always comes from the patient
                    {"intent": "SMALL_TALK"},  # not one of the classifier's seven labels
                    {"channel": "sms"},  # unsupported channel
                    {"conversation_id": "does-not-exist"}):  # must belong to a conversation
            with self.subTest(bad=bad), self.assertRaises(sqlite3.IntegrityError):
                self.insert_message(channel_message_id=f"wamid.BAD{len(str(bad))}", **bad)

    def test_rejects_unknown_appointment_status(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO appointments VALUES ('a99', 'c01', 'Cleaning', '2026-04-01T08:30:00Z', 'maybe', 0)")


if __name__ == "__main__":
    unittest.main()
