"""The same SQL-vs-Python check as test_analytics.py, on a real PostgreSQL server.

Runs in CI against a PostgreSQL 16 service container; skipped locally unless PostgreSQL is
configured (PGHOST etc.) and psycopg is installed.
"""

import os
import unittest

import kpi_report
from test_analytics import HERE, SAMPLE, load_queries

try:
    import psycopg
except ImportError:  # optional locally, installed in CI
    psycopg = None


def rows(cur, query):
    cur.execute(query)
    columns = [d.name for d in cur.description]
    return [dict(zip(columns, r)) for r in cur.fetchall()]


@unittest.skipUnless(psycopg and os.environ.get("PGHOST"), "PostgreSQL not configured")
class PostgresMatchesPythonTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        data = kpi_report.load_export(SAMPLE)
        cls.kpis = kpi_report.compute_kpis(data)
        cls.queries = load_queries()
        cls.conn = psycopg.connect(autocommit=True)  # connection settings come from PG* variables
        cur = cls.conn.cursor()
        cur.execute("DROP SCHEMA IF EXISTS clinic_kpi_test CASCADE")
        cur.execute("CREATE SCHEMA clinic_kpi_test")
        cur.execute("SET search_path TO clinic_kpi_test")
        cur.execute((HERE / "schema.sql").read_text(encoding="utf-8"))

        first_seen = {}
        for c in data["conversations"]:
            key = (c["channel"], c["user_id"])
            first_seen[key] = min(first_seen.get(key, c["started_at"]), c["started_at"])
        cur.executemany("INSERT INTO patients (channel, user_id, first_seen_at) VALUES (%s, %s, %s)",
                        [(ch, user, seen) for (ch, user), seen in first_seen.items()])
        cur.executemany("INSERT INTO conversations VALUES "
                        "(%(conversation_id)s, %(channel)s, %(user_id)s, %(started_at)s)", data["conversations"])
        cur.executemany(
            "INSERT INTO messages (channel, channel_message_id, conversation_id, sent_at, direction, sender, intent, body) "
            "VALUES (%(channel)s, %(channel_message_id)s, %(conversation_id)s, %(sent_at)s, %(direction)s, "
            "%(sender)s, %(intent)s, %(body)s)",
            [{**m, "intent": m["intent"] or None, "body": m["body"] or None} for m in data["messages"]],
        )
        cur.executemany(
            "INSERT INTO appointments VALUES (%(appointment_id)s, %(conversation_id)s, %(service)s, "
            "%(start_at)s, %(status)s, %(reminder_sent)s)",
            [{**a, "reminder_sent": kpi_report.is_true(a["reminder_sent"])} for a in data["appointments"]],
        )
        cls.cur = cur

    @classmethod
    def tearDownClass(cls):
        cls.cur.execute("DROP SCHEMA IF EXISTS clinic_kpi_test CASCADE")
        cls.conn.close()

    def test_automation_rate(self):
        [row] = rows(self.cur, self.queries["automation_rate"])
        self.assertEqual(row["handled_by_ai_only"], self.kpis["handled_by_ai_only"])
        self.assertEqual(float(row["automation_rate_pct"]), self.kpis["automation_rate_pct"])

    def test_booking_conversion(self):
        [row] = rows(self.cur, self.queries["booking_conversion"])
        self.assertEqual(row["converted"], self.kpis["converted"])
        self.assertEqual(float(row["booking_conversion_pct"]), self.kpis["booking_conversion_pct"])

    def test_no_show_rate(self):
        by_label = {r["reminder"]: r for r in rows(self.cur, self.queries["no_show_rate"])}
        for label, expected in self.kpis["no_show"].items():
            self.assertEqual(by_label[label]["no_shows"], expected["no_shows"])
            self.assertEqual(float(by_label[label]["no_show_rate_pct"]), expected["no_show_rate_pct"])

    def test_bookings_by_channel(self):
        result = rows(self.cur, self.queries["bookings_by_channel"])
        self.assertEqual({r["channel"]: r["appointments"] for r in result}, self.kpis["bookings_by_channel"])

    def test_webhook_retry_is_rejected(self):
        with self.assertRaises(psycopg.errors.UniqueViolation):
            self.cur.execute("INSERT INTO messages SELECT * FROM messages LIMIT 1")


if __name__ == "__main__":
    unittest.main()
