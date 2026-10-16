"""KPI report for the Healthcare AI Receptionist.

Reads the conversation log exported from the clinic system (three CSV files) and computes
the metrics the clinic manages against:

* automation rate      - conversations resolved without a single staff message
* first-response time  - patient's first message -> first reply (P50 / P95)
* booking conversion   - conversations that asked to book and ended in an appointment
* no-show rate         - completed appointments, with and without a reminder
* bookings by channel

kpis.sql defines the same metrics in SQL; test_analytics.py checks that both give the same answers.

Usage:
    python kpi_report.py [export_folder]      # defaults to ./sample_data
"""

from __future__ import annotations

import csv
import math
import sys
from collections import Counter, defaultdict
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

CONFIRMED = {"booked", "attended", "no_show"}  # an appointment that was actually booked
COMPLETED = {"attended", "no_show"}  # an appointment whose date has passed
TABLES = ("conversations", "messages", "appointments")


def load_export(folder: str | Path) -> dict[str, list[dict]]:
    """Load conversations.csv, messages.csv and appointments.csv from an export folder."""
    folder = Path(folder)
    data = {}
    for table in TABLES:
        with (folder / f"{table}.csv").open(newline="", encoding="utf-8") as f:
            data[table] = list(csv.DictReader(f))
    return data


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def is_true(value) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes"}


def rate(part: int, whole: int) -> float | None:
    """Percentage with one decimal, rounded half-up exactly like SQL's ROUND()."""
    if whole == 0:
        return None
    pct = Decimal(100 * part) / Decimal(whole)
    return float(pct.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def percentile(values: list[float], pct: float) -> float | None:
    """Nearest-rank percentile: the smallest value with at least pct% of observations at or below it."""
    if not values:
        return None
    ordered = sorted(values)
    rank = max(math.ceil(pct / 100 * len(ordered)), 1)
    return ordered[rank - 1]


def first_response_seconds(thread: list[dict]) -> float | None:
    """Seconds from the patient's first message to the first reply after it (AI or staff)."""
    thread = sorted(thread, key=lambda m: parse_time(m["sent_at"]))
    first_in = next((m for m in thread if m["direction"] == "inbound"), None)
    if first_in is None:
        return None
    asked_at = parse_time(first_in["sent_at"])
    reply = next((m for m in thread if m["direction"] == "outbound" and parse_time(m["sent_at"]) >= asked_at), None)
    if reply is None:
        return None
    return (parse_time(reply["sent_at"]) - asked_at).total_seconds()


def compute_kpis(data: dict[str, list[dict]]) -> dict:
    conversations, messages, appointments = (data[t] for t in TABLES)

    threads = defaultdict(list)
    for message in messages:
        threads[message["conversation_id"]].append(message)

    # Automation rate: no staff message anywhere in the conversation
    ai_only = sum(
        1 for c in conversations
        if not any(m["sender"] == "staff" for m in threads[c["conversation_id"]])
    )

    # First-response time across conversations that received a reply
    response_times = [
        seconds for c in conversations
        if (seconds := first_response_seconds(threads[c["conversation_id"]])) is not None
    ]

    # Booking conversion: asked to book -> has a confirmed appointment
    asked_to_book = {m["conversation_id"] for m in messages if m["intent"] == "BOOKING_REQUEST"}
    booked = {a["conversation_id"] for a in appointments if a["status"] in CONFIRMED}
    converted = asked_to_book & booked

    # No-show rate, with and without a reminder
    no_show = {}
    for label, reminded in (("with reminder", True), ("without reminder", False)):
        done = [a for a in appointments if a["status"] in COMPLETED and is_true(a["reminder_sent"]) == reminded]
        missed = sum(1 for a in done if a["status"] == "no_show")
        no_show[label] = {
            "completed_appointments": len(done),
            "no_shows": missed,
            "no_show_rate_pct": rate(missed, len(done)),
        }

    # Bookings by channel (cancellations excluded)
    channel_of = {c["conversation_id"]: c["channel"] for c in conversations}
    by_channel = Counter(channel_of[a["conversation_id"]] for a in appointments if a["status"] != "cancelled")

    return {
        "conversations": len(conversations),
        "handled_by_ai_only": ai_only,
        "automation_rate_pct": rate(ai_only, len(conversations)),
        "first_response_p50_s": percentile(response_times, 50),
        "first_response_p95_s": percentile(response_times, 95),
        "replied_within_2_min_pct": rate(sum(1 for s in response_times if s <= 120), len(response_times)),
        "booking_conversations": len(asked_to_book),
        "converted": len(converted),
        "booking_conversion_pct": rate(len(converted), len(asked_to_book)),
        "no_show": no_show,
        "bookings_by_channel": dict(sorted(by_channel.items(), key=lambda kv: (-kv[1], kv[0]))),
    }


def render_markdown(k: dict) -> str:
    def pct(value):
        return "n/a" if value is None else f"{value:g}%"

    def secs(value):
        return "n/a" if value is None else f"{value:g} s"

    lines = [
        "# Healthcare AI Receptionist — KPI report",
        "",
        "| Metric | Value |",
        "|---|---|",
        f"| Conversations | {k['conversations']} |",
        f"| Automation rate (no staff message) | {pct(k['automation_rate_pct'])} |",
        f"| First response — P50 / P95 | {secs(k['first_response_p50_s'])} / {secs(k['first_response_p95_s'])} |",
        f"| Replied within 2 minutes | {pct(k['replied_within_2_min_pct'])} |",
        f"| Booking conversion | {pct(k['booking_conversion_pct'])} ({k['converted']} of {k['booking_conversations']}) |",
    ]
    for label, row in k["no_show"].items():
        lines.append(f"| No-show rate, {label} | {pct(row['no_show_rate_pct'])} "
                     f"({row['no_shows']} of {row['completed_appointments']}) |")
    channels = ", ".join(f"{channel} {count}" for channel, count in k["bookings_by_channel"].items())
    lines.append(f"| Bookings by channel | {channels or 'n/a'} |")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    folder = Path(argv[1]) if len(argv) > 1 else Path(__file__).parent / "sample_data"
    print(render_markdown(compute_kpis(load_export(folder))))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
