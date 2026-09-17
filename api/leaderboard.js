// Vercel serverless function: global leaderboard backed by Upstash Redis.
// Works with either the Upstash Marketplace integration (UPSTASH_REDIS_REST_*)
// or the legacy Vercel KV integration (KV_REST_API_*).
import { Redis } from '@upstash/redis';

const KEY = 'athome-penny:leaderboard';
const TOP = 10;
const KEEP = 50;

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const redis = getRedis();
  if (!redis) {
    return res.status(503).json({ error: 'Leaderboard storage not configured. Add the Upstash Redis integration in Vercel.' });
  }

  try {
    if (req.method === 'GET') {
      // [{member, score}, ...] highest first
      const raw = await redis.zrange(KEY, 0, TOP - 1, { rev: true, withScores: true });
      const out = [];
      for (let i = 0; i < raw.length; i += 2) {
        const m = typeof raw[i] === 'string' ? JSON.parse(raw[i]) : raw[i];
        out.push({ name: m.name, time: m.time, served: m.served, score: Math.round(raw[i + 1]) });
      }
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(out);
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      body = body || {};

      const score = Number(body.score);
      if (!Number.isFinite(score) || score < 0 || score > 10_000_000) {
        return res.status(400).json({ error: 'Invalid score' });
      }
      const name = String(body.name || 'Anonymous').replace(/[<>]/g, '').trim().slice(0, 20) || 'Anonymous';
      const time = String(body.time || '').slice(0, 12);
      const served = Math.max(0, Math.min(100000, Number(body.served) || 0));

      const member = JSON.stringify({ name, time, served, ts: Date.now() });
      await redis.zadd(KEY, { score: Math.round(score), member });
      // keep only the best KEEP entries
      await redis.zremrangebyrank(KEY, 0, -(KEEP + 1));
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Leaderboard error', detail: String(err && err.message || err) });
  }
}
