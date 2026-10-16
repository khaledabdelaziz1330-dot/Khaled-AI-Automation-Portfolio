'use strict';
// holistic-wellness-club: GoHighLevel retries the same webhook; each event must be logged once.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runCode, loadWorkflow, outgoing } = require('./helpers/n8n');

const P = 'holistic-wellness-club';

const normalize = body => runCode(P, 'Normalize Event', { input: [{ body }] })[0];

test('maps GoHighLevel event types onto one schema', () => {
  const ev = normalize({
    id: 'evt_123', type: 'AppointmentCreate', contactId: 'c_9', dateAdded: '2026-02-19T10:00:00Z',
    contact: { firstName: 'Sara', lastName: 'Adel', email: 'sara@example.com' },
    appointment: { id: 'apt_1', startTime: '2026-02-21T09:00:00Z', appointmentStatus: 'confirmed', title: 'Yoga' },
  });
  assert.equal(ev.event_id, 'evt_123');
  assert.equal(ev.event_type, 'appointment.created');
  assert.equal(ev.contact.name, 'Sara Adel');
  assert.equal(ev.appointment.status, 'confirmed');
});

test('unknown event types are kept and labelled, not dropped', () => {
  assert.equal(normalize({ id: 'e1', type: 'InvoicePaid' }).event_type, 'ghl.InvoicePaid');
});

test('a retried event is recognised as a duplicate and skipped', () => {
  const event = normalize({ id: 'evt_123', type: 'ContactCreate', dateAdded: '2026-02-19T10:00:00Z' });
  const [out] = runCode(P, 'Enrich & Idempotency', {
    input: [{ event_id: 'evt_123', event_type: 'lead.created' }], // already in the AllEvents index
    nodes: { 'Normalize Event': [event] },
  });
  assert.equal(out._processed, false);
  assert.equal(out._skip_reason, 'duplicate_event');
});

test('a first-seen event is processed', () => {
  const event = normalize({ id: 'evt_456', type: 'ContactCreate', dateAdded: '2026-02-19T10:00:00Z' });
  const [out] = runCode(P, 'Enrich & Idempotency', { input: [{}], nodes: { 'Normalize Event': [event] } });
  assert.equal(out._processed, true);
});

test('first-seen events are recorded in the index the duplicate check reads', () => {
  const wf = loadWorkflow(P);
  const trueBranch = outgoing(wf, 'Not Duplicate?').filter(c => c.output === 0).map(c => c.target);
  assert.ok(trueBranch.includes('Record Event ID'));
  const record = wf.nodes.find(n => n.name === 'Record Event ID');
  const lookup = wf.nodes.find(n => n.name === 'Check Duplicates');
  assert.equal(record.parameters.sheetName.value, lookup.parameters.sheetName.value);
  assert.equal(record.parameters.columns.value.event_id, '={{ $json.event_id }}');
});
