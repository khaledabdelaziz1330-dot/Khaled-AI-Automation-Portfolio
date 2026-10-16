'use strict';
// lead-generation-system: every scraped business is processed once, and nobody is contacted twice.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runCode, loadWorkflow, outgoing } = require('./helpers/n8n');

const P = 'lead-generation-system';
const CAMPAIGN = [{ campaign_id: 'cmp_1' }];

const place = (title, email, phone, website) => ({ title, emails: email ? [email] : [], phone, website, city: 'Cairo' });

const extract = input => runCode(P, 'Extract Lead Fields', { input, nodes: { 'Get Active Campaigns': CAMPAIGN } });

test('reads every scraped business, whether Apify returns items or one array', () => {
  const places = [place('Clinic A', 'a@a.com'), place('Clinic B', 'b@b.com'), place('Clinic C', 'c@c.com')];
  assert.equal(extract(places).length, 3); // one item per business
  assert.equal(extract([places]).length, 3); // one item holding an array
});

test('drops businesses without an email address', () => {
  const out = extract([place('No Email Ltd', null), place('Clinic A', 'a@a.com')]);
  assert.deepEqual(out.map(l => l.business_name), ['Clinic A']);
  assert.equal(out[0].campaign_id, 'cmp_1');
});

test('deduplicates against existing leads by email, phone and domain', () => {
  const fresh = [
    { business_name: 'Same Email', email: 'INFO@smile.com ', phone: '', website: '' },
    { business_name: 'Same Phone', email: 'new1@x.com', phone: '+20 100 000 0001', website: '' },
    { business_name: 'Same Domain', email: 'new2@x.com', phone: '', website: 'https://www.brightdental.com/contact' },
    { business_name: 'Genuinely New', email: 'hello@newclinic.com', phone: '+20 100 999 9999', website: 'newclinic.com' },
  ];
  const existing = [
    { email: 'info@smile.com' },
    { phone: '201000000001' },
    { website: 'brightdental.com' },
  ];
  const out = runCode(P, 'Deduplicate', { nodes: { 'Extract Lead Fields': fresh, 'Get Existing Leads': existing } });
  assert.deepEqual(out.map(l => l.business_name), ['Genuinely New']);
  assert.equal(out[0].lead_status, 'new');
  assert.match(out[0].lead_id, /^lead_/);
});

test('also deduplicates within the same scrape', () => {
  const fresh = [
    { business_name: 'Branch 1', email: 'care@chain.com', phone: '', website: '' },
    { business_name: 'Branch 2', email: 'care@chain.com', phone: '', website: '' },
  ];
  const out = runCode(P, 'Deduplicate', { nodes: { 'Extract Lead Fields': fresh, 'Get Existing Leads': [{}] } });
  assert.equal(out.length, 1);
});

test('dedup runs once per scrape, after existing leads are loaded', () => {
  const wf = loadWorkflow(P);
  assert.deepEqual(outgoing(wf, 'Extract Lead Fields').map(c => c.target), ['Get Existing Leads']);
  assert.deepEqual(outgoing(wf, 'Get Existing Leads').map(c => c.target), ['Deduplicate']);
  const lookup = wf.nodes.find(n => n.name === 'Get Existing Leads');
  assert.equal(lookup.executeOnce, true);
  assert.equal(lookup.alwaysOutputData, true); // a brand-new campaign has no existing leads
});
