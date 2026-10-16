'use strict';
// shared-error-handler: secrets and PII never reach a log row or a Slack alert.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runCode } = require('./helpers/n8n');

const sanitize = failure => runCode('shared-error-handler', 'Sanitize & Classify', { input: [failure] })[0];

const failure = (lastNode, message, extra = {}) => ({
  workflow: { id: '7', name: 'Clinic AI Receptionist' },
  execution: { id: '981', url: 'https://n8n.example.com/execution/981', lastNodeExecuted: lastNode, error: { message, ...extra } },
});

test('redacts tokens, API keys, emails and phone numbers in free text', () => {
  const out = sanitize(failure('Send Reply via API',
    '401 Unauthorized: Bearer EAAGm0PX4ZCpsBA123abc key sk-live-1234567890abcdef for ali@example.com +20 109 123 4567'));
  assert.equal(out.error_message, '401 Unauthorized: Bearer [REDACTED] key [REDACTED_KEY] for [EMAIL] [PHONE]');
});

test('redacts sensitive fields by key name, at any depth', () => {
  const out = sanitize(failure('Get Calendar Events', 'boom', {
    headers: { Authorization: 'Bearer abc', 'x-api-key': 'k' },
    request: { body: { password: 'hunter2', session_token: 't', note: 'fine' } },
  }));
  assert.equal(out.context.headers.Authorization, '[REDACTED]');
  assert.equal(out.context.headers['x-api-key'], '[REDACTED]');
  assert.equal(out.context.request.body.password, '[REDACTED]');
  assert.equal(out.context.request.body.session_token, '[REDACTED]');
  assert.equal(out.context.request.body.note, 'fine');
});

test('customer-facing and auth failures are high severity (paged in Slack)', () => {
  assert.equal(sanitize(failure('Send Reply via API', 'socket error')).severity, 'high');
  assert.equal(sanitize(failure('Get Knowledge Base', 'Request failed with status code 403')).severity, 'high');
});

test('transient failures are low severity (log only)', () => {
  assert.equal(sanitize(failure('Get Knowledge Base', '429 Too Many Requests: rate limit')).severity, 'low');
  assert.equal(sanitize(failure('Read RSS Feed', 'ETIMEDOUT')).severity, 'low');
});

test('everything else is medium severity', () => {
  assert.equal(sanitize(failure('Normalize Event', 'Cannot read properties of undefined')).severity, 'medium');
});

test('caps oversized payloads before storage', () => {
  const out = sanitize(failure('Normalize Event', 'x', { body: 'a'.repeat(10000) }));
  assert.equal(out.context.body.length, 2000);
});

test('keeps the execution link so the failure can be traced', () => {
  const out = sanitize(failure('Normalize Event', 'boom'));
  assert.equal(out.execution_url, 'https://n8n.example.com/execution/981');
  assert.equal(out.workflow_name, 'Clinic AI Receptionist');
  assert.equal(out.failed_node, 'Normalize Event');
});
