/**
 * One shared MongoDB connection per process (Next.js dev reloads included).
 * The connection string comes from MONGODB_URI — never hard-code it.
 */
import mongoose from "mongoose";

type Cache = { promise: Promise<typeof mongoose> | null };
const g = globalThis as unknown as { __505thMongo?: Cache };
const cache: Cache = (g.__505thMongo ??= { promise: null });

export async function connectDb(uri = process.env.MONGODB_URI, dbName = process.env.MONGODB_DB ?? "505th"): Promise<typeof mongoose> {
  if (!uri) throw new Error("MONGODB_URI is not set. Add it to your .env.local (never commit it).");
  cache.promise ??= mongoose.connect(uri, {
    dbName,
    serverSelectionTimeoutMS: 10_000,
    // Atlas free tier (M0) allows ~500 connections in total. Each Vercel function copy used to open up to 100,
    // so a busy minute hit the cap → "SystemOverloadedError" / TLS errors and the terminal bounced to /boot.
    // Website functions: 5 each. Cortana (one long-running process): 20.
    // 15 Nov: Atlas "connections near the M0 limit" alert. Every warm Vercel copy keeps its own connections,
    // so keep each copy tiny: 2 in the pool, close idle ones after 10 s, and "poll" monitoring
    // (1 monitor connection per server instead of 2). Cortana (one long process) keeps 10.
    maxPoolSize: process.env.VERCEL ? 2 : 10,
    minPoolSize: 0,
    maxIdleTimeMS: process.env.VERCEL ? 10_000 : 60_000,
    serverMonitoringMode: "poll",
    waitQueueTimeoutMS: 8_000,
  }).catch((err) => {
    cache.promise = null;
    throw err;
  });
  return cache.promise;
}

/**
 * After a database network / overload error, throw away this copy's connection so the NEXT request
 * opens a fresh one (a warm Vercel copy could otherwise keep failing for minutes — 13 Nov 23:24).
 */
let lastReset = 0;
export function resetDbIfBroken(err: unknown) {
  const e = err as { name?: string; errorLabelSet?: Set<string>; code?: string } | null;
  const broken = !!e && (e.name === "MongoNetworkError" || e.name === "MongoServerSelectionError" || e.errorLabelSet?.has("SystemOverloadedError") || e.errorLabelSet?.has("ResetPool"));
  if (!broken || Date.now() - lastReset < 10_000) return broken;
  lastReset = Date.now();
  const p = cache.promise;
  cache.promise = null;
  void p?.then((m) => m.disconnect()).catch(() => {});
  return true;
}

export async function disconnectDb() {
  if (cache.promise) {
    await (await cache.promise).disconnect();
    cache.promise = null;
  }
}
