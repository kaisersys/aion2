'use strict';
const { periods } = require('./periods.cjs');
const TYPES = new Set(['kinah_earned', 'kinah_spent', 'wallet_snapshot', 'counter', 'item_change']);
const FREQ = new Set(['daily', 'weekly']);
const SCOPES = new Set(['character', 'server']);
const MAX_AMOUNT = 100000000000000;
const MAX_EVENTS = 50000;
function safeText(value, limit) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}
function validInt(value, ceiling = MAX_AMOUNT) {
  return Number.isSafeInteger(value) && value >= 0 && value <= ceiling;
}
function charKey(character, server) {
  return String(server || '').trim().toLocaleLowerCase('en-US') + '/' +
    String(character || '').trim().toLocaleLowerCase('en-US');
}
function normalizeEvent(input, fallbackId) {
  if (!input || typeof input !== 'object' || !TYPES.has(input.type)) throw new Error('Unsupported event type');
  const character = safeText(input.character, 40);
  const server = safeText(input.server, 48);
  const id = safeText(input.id || fallbackId, 128);
  const occurred_at = input.occurred_at || new Date().toISOString();
  const time = Date.parse(occurred_at);
  if (!character || !server || !id || !Number.isFinite(time) ||
      time < Date.UTC(2026,0,1) || time > Date.now() + 86400000) throw new Error('Invalid event identity or time');
  const ev = { id, character, server, type: input.type,
    occurred_at: new Date(time).toISOString(),
    source: input.source === 'decoded' ? 'decoded' : 'manual' };
  if (ev.type === 'kinah_earned' || ev.type === 'kinah_spent') {
    if (!validInt(input.amount) || input.amount === 0) throw new Error('Invalid Kinah amount');
    ev.amount = input.amount;
  } else if (ev.type === 'item_change') {
    // Item-level observations are read-only decoder outputs, never entries
    // entered manually or returned from untrusted remote sources.
    if(ev.source!=='decoded' ||
       !Number.isSafeInteger(input.item_id) || input.item_id < 100000000 ||
       input.item_id >= 1000000000 ||
       !Number.isSafeInteger(input.delta) || input.delta===0 ||
       Math.abs(input.delta)>100000000000 ||
       typeof input.observation_session!=='string' ||
       !/^[0-9a-f]{32}$/.test(input.observation_session))
      throw new Error('Invalid decoded item change');
    ev.item_id=input.item_id;
    ev.delta=input.delta;
    ev.observation_session=input.observation_session;
  } else if (ev.type === 'wallet_snapshot') {
    if (!validInt(input.balance)) throw new Error('Invalid wallet balance');
    ev.balance = input.balance;
    if (input.currency_kind === 'bound' || input.currency_kind === 'unbound')
      ev.currency_kind = input.currency_kind;
    // Session boundaries are local provenance only. Never upload the session
    // identifier, and never infer purchases/sales across separate game logins.
    if (ev.source === 'decoded' && typeof input.observation_session === 'string' &&
        /^[0-9a-f]{32}$/.test(input.observation_session))
      ev.observation_session = input.observation_session;
  } else {
    ev.key = safeText(input.key, 90);
    ev.frequency = input.frequency;
    ev.scope = input.scope || 'character';
    ev.current = input.current;
    ev.maximum = input.maximum;
    if (!/^[a-z0-9-]{1,90}$/.test(ev.key) || !FREQ.has(ev.frequency) ||
      !SCOPES.has(ev.scope) || !validInt(ev.current, 1000000) ||
      !validInt(ev.maximum, 1000000) || ev.current > ev.maximum) {
      throw new Error('Invalid counter');
    }
  }
  return ev;
}
function addEvents(existing, incoming) {
  const known = new Set(existing.map(e => e.id));
  const added = [];
  for (const event of incoming) {
    if (!known.has(event.id)) { known.add(event.id); added.push(event); }
  }
  return { events: existing.concat(added).slice(-MAX_EVENTS), added };
}
function summarize(events, character, server, now = Date.now()) {
  const p = periods(now);
  const filtered = events.filter(e => charKey(e.character,e.server) === charKey(character,server) &&
    Date.parse(e.occurred_at) <= now).sort((a,b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at));
  const sums = { dayEarned:0, daySpent:0, weekEarned:0, weekSpent:0 };
  let wallet = null;
  const wallets = { bound:null, unbound:null };
  let firstUnboundToday = null, lastUnboundToday = null, readingsUnboundToday = 0;
  const counters = new Map();
  for (const e of filtered) {
    const at = Date.parse(e.occurred_at);
    if (e.type === 'wallet_snapshot') {
      const snapshot = { balance:e.balance, occurred_at:e.occurred_at };
      if (e.currency_kind === 'bound' || e.currency_kind === 'unbound') {
        wallets[e.currency_kind] = snapshot;
        if (e.currency_kind === 'unbound' && at >= p.dailyAt) {
          if (firstUnboundToday === null) firstUnboundToday = e.balance;
          lastUnboundToday = e.balance;
          readingsUnboundToday++;
        }
      } else wallet = snapshot; // legacy manual entries remain separate and unlabeled
    }
    if (e.type === 'kinah_earned' || e.type === 'kinah_spent') {
      const field = e.type === 'kinah_earned' ? 'Earned' : 'Spent';
      if (at >= p.dailyAt) sums['day'+field] += e.amount;
      if (at >= p.weeklyAt) sums['week'+field] += e.amount;
    }
    if (e.type === 'counter') {
      const start = e.frequency === 'daily' ? p.dailyAt : p.weeklyAt;
      if (at >= start) counters.set(e.frequency + ':' + e.key,
        { ...e, period_start:e.frequency === 'daily' ? p.day : p.week });
    }
  }
  return { ...sums, wallet, wallets,
    unboundNetToday:readingsUnboundToday>=2 ? lastUnboundToday-firstUnboundToday : null,
    counters:Array.from(counters.values()),
    recent: filtered.slice(-8).reverse(), periods:p, eventCount:filtered.length };
}
module.exports = { normalizeEvent, addEvents, summarize, periods, charKey };
