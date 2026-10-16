'use strict';
// marketing-lead-engine (Marketing Content Pipeline): consent first, and email only at an
// address the publisher made public. Addresses are never guessed.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runCode, loadWorkflow, outgoing } = require('./helpers/n8n');

const P = 'marketing-lead-engine';
const hoursAgo = h => new Date(Date.now() - h * 3600 * 1000).toISOString();

const rssItem = overrides => ({
  link: 'https://www.techjournal.com/ai-in-clinics',
  title: 'How AI is changing clinic operations',
  contentSnippet: 'Clinics are adopting AI receptionists...',
  isoDate: hoursAgo(3),
  ...overrides,
});

const filter = (items, seen = []) => runCode(P, 'Filter New & Recent', { input: seen, nodes: { 'Read RSS Feed': items } });

const compose = article =>
  runCode(P, 'Compose Permission Request', {
    input: [{ message: { content: JSON.stringify({ linkedin_post: 'Draft post', facts_preserved: ['fact'] }) } }],
    nodes: { 'Filter New & Recent': [article] },
  })[0];

test('keeps only unseen articles from the last 48 hours', () => {
  const out = filter(
    [rssItem({ link: 'https://a.com/new' }), rssItem({ link: 'https://a.com/old', isoDate: hoursAgo(72) }), rssItem({ link: 'https://a.com/seen' })],
    [{ url: 'https://a.com/seen' }],
  );
  assert.deepEqual(out.map(a => a.url), ['https://a.com/new']);
});

test('uses the author address the publisher lists in the feed', () => {
  const [article] = filter([rssItem({ author: 'Jane.Doe@TechJournal.com (Jane Doe)' })]);
  assert.equal(article.author, 'Jane Doe');
  assert.equal(article.author_contact_email, 'jane.doe@techjournal.com');

  const request = compose(article);
  assert.equal(request.author_email, 'jane.doe@techjournal.com');
  assert.equal(request.status, 'pending_response');
  assert.ok(request.response_deadline);
});

test('never guesses an address from a name and domain', () => {
  const [article] = filter([rssItem({ creator: 'John Smith' })]);
  assert.equal(article.author, 'John Smith');
  assert.equal(article.author_contact_email, null);

  const request = compose(article);
  assert.equal(request.author_email, null);
  assert.equal(request.status, 'needs_contact');
  assert.doesNotMatch(JSON.stringify(request), /john\.smith@|editor@/i);
});

test('the email step is reachable only through the verified-contact gate', () => {
  const wf = loadWorkflow(P);
  assert.deepEqual(outgoing(wf, 'Compose Permission Request').map(c => c.target), ['Has Verified Contact?']);
  const gate = outgoing(wf, 'Has Verified Contact?');
  assert.deepEqual(gate.filter(c => c.output === 0).map(c => c.target), ['Send Permission Email']);
  assert.deepEqual(gate.filter(c => c.output === 1).map(c => c.target), ['Log Permission Request']);
  const intoSend = Object.entries(wf.connections)
    .filter(([, conn]) => (conn.main || []).some(targets => (targets || []).some(t => t.node === 'Send Permission Email')))
    .map(([source]) => source);
  assert.deepEqual(intoSend, ['Has Verified Contact?']);
});

test('every request is logged, sent or not', () => {
  const wf = loadWorkflow(P);
  assert.deepEqual(outgoing(wf, 'Send Permission Email').map(c => c.target), ['Log Permission Request']);
  assert.deepEqual(outgoing(wf, 'Log Permission Request').map(c => c.target), ['Mark as Seen']);
});
