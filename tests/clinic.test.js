'use strict';
// clinic-booking-system: one schema for four channels, and availability that code — not the
// model — decides, in the clinic's time zone whatever the server's time zone is.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { runCode } = require('./helpers/n8n');

const P = 'clinic-booking-system';

describe('Normalize Payload', () => {
  const normalize = raw => runCode(P, 'Normalize Payload', { input: [raw] })[0];

  test('WhatsApp', () => {
    const out = normalize({ entry: [{ changes: [{ value: {
      contacts: [{ profile: { name: 'Mona' } }],
      messages: [{ from: '201001112223', id: 'wamid.1', type: 'text', text: { body: 'عايزة احجز' }, timestamp: '1760000000' }],
    } }] }] });
    assert.equal(out.channel, 'whatsapp');
    assert.equal(out.user_id, '201001112223');
    assert.equal(out.user_name, 'Mona');
    assert.equal(out.message_text, 'عايزة احجز');
  });

  test('Instagram and Messenger', () => {
    const event = { sender: { id: 'psid_9' }, timestamp: 1760000000000, message: { mid: 'm_1', text: 'Price of cleaning?' } };
    const ig = normalize({ object: 'instagram', entry: [{ messaging: [event] }] });
    const fb = normalize({ object: 'page', entry: [{ messaging: [event] }] });
    assert.equal(ig.channel, 'instagram');
    assert.equal(fb.channel, 'messenger');
    assert.equal(fb.message_text, 'Price of cleaning?');
    assert.equal(fb.timestamp, 1760000000);
  });

  test('Telegram', () => {
    const out = normalize({ message: { chat: { id: 5 }, from: { id: 77, first_name: 'Omar', last_name: 'Ali' }, message_id: 12, text: 'Hi', date: 1760000000 } });
    assert.equal(out.channel, 'telegram');
    assert.equal(out.user_id, '77');
    assert.equal(out.user_name, 'Omar Ali');
  });

  test('unknown payloads are rejected, not guessed', () => {
    assert.throws(() => normalize({ foo: 'bar' }), /Unsupported channel payload/);
  });
});

describe('Calculate Availability', () => {
  // 2035 dates keep the "minimum lead time" check out of the way.
  const SUMMER_MONDAY = '2035-06-11'; // Cairo UTC+3 (daylight saving)
  const WINTER_MONDAY = '2035-12-10'; // Cairo UTC+2
  const FRIDAY = '2035-06-15'; // clinic closed

  const cairo = iso => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Cairo', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(iso));
    const get = t => parts.find(p => p.type === t).value;
    return { date: `${get('year')}-${get('month')}-${get('day')}`, weekday: get('weekday'), hhmm: `${get('hour')}:${get('minute')}` };
  };

  const availability = ({ date, time, events = [], tz = 'UTC' }) => {
    const previous = process.env.TZ;
    process.env.TZ = tz; // simulate the n8n server's time zone
    try {
      return runCode(P, 'Calculate Availability', {
        nodes: {
          'Extract Booking Details': [{ message: { content: JSON.stringify({ preferred_date: date, preferred_time: time }) } }],
          'Get Calendar Events': events,
        },
        now: { setZone: () => ({ toFormat: () => date }) },
      })[0];
    } finally {
      process.env.TZ = previous;
    }
  };

  const event = (startIso, endIso) => ({ start: { dateTime: startIso }, end: { dateTime: endIso } });

  test('offers 09:00–19:00 Cairo time even when the server runs on UTC', () => {
    for (const date of [SUMMER_MONDAY, WINTER_MONDAY]) {
      const out = availability({ date, time: '09:00' });
      assert.equal(out.suggested_slots.length, 3);
      for (const slot of out.suggested_slots) {
        const start = cairo(slot.start_iso);
        assert.ok(start.hhmm >= '09:00' && start.hhmm <= '18:30', `slot at ${start.hhmm} Cairo time`);
      }
      assert.equal(cairo(out.suggested_slots[0].start_iso).hhmm, '09:00');
    }
  });

  test('gives the same answer whatever the server time zone', () => {
    const base = availability({ date: SUMMER_MONDAY, time: '14:00', tz: 'UTC' }).suggested_slots;
    for (const tz of ['Africa/Cairo', 'Asia/Tokyo', 'America/New_York']) {
      assert.deepEqual(availability({ date: SUMMER_MONDAY, time: '14:00', tz }).suggested_slots, base, tz);
    }
  });

  test('ranks slots by closeness to the preferred time', () => {
    const out = availability({ date: WINTER_MONDAY, time: '14:00' });
    assert.deepEqual(out.suggested_slots.map(s => cairo(s.start_iso).hhmm), ['14:00', '13:30', '14:30']);
  });

  test('never offers a slot on Friday', () => {
    const out = availability({ date: FRIDAY, time: '10:00' });
    assert.ok(out.has_availability);
    for (const slot of out.suggested_slots) assert.notEqual(cairo(slot.start_iso).weekday, 'Fri');
  });

  test('keeps a 15-minute buffer around existing appointments', () => {
    // Existing appointment 10:00–11:00 Cairo (UTC+3 in June) = 07:00–08:00 UTC
    const out = availability({ date: SUMMER_MONDAY, time: '10:30', events: [event('2035-06-11T07:00:00Z', '2035-06-11T08:00:00Z')] });
    const offered = out.suggested_slots.map(s => cairo(s.start_iso).hhmm);
    for (const blocked of ['09:30', '10:00', '10:30', '11:00']) assert.ok(!offered.includes(blocked), `offered blocked slot ${blocked}`);
    assert.deepEqual(offered, ['11:30', '09:00', '12:00']);
  });

  test('falls back to the next open days when the requested day is full', () => {
    const fullDay = event('2035-06-11T05:00:00Z', '2035-06-11T17:00:00Z'); // 08:00–20:00 Cairo
    const out = availability({ date: SUMMER_MONDAY, time: '09:00', events: [fullDay] });
    assert.ok(out.has_availability);
    for (const slot of out.suggested_slots) assert.equal(cairo(slot.start_iso).date, '2035-06-12');
  });

  test('ignores a malformed date from the model and uses today', () => {
    const out = runCode(P, 'Calculate Availability', {
      nodes: {
        'Extract Booking Details': [{ message: { content: JSON.stringify({ preferred_date: 'next tuesday', preferred_time: null }) } }],
        'Get Calendar Events': [],
      },
      now: { setZone: () => ({ toFormat: () => SUMMER_MONDAY }) },
    })[0];
    assert.equal(out.requested_date, SUMMER_MONDAY);
    assert.equal(cairo(out.suggested_slots[0].start_iso).date, SUMMER_MONDAY);
  });
});
