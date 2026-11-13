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
    maxPoolSize: process.env.VERCEL ? 5 : 20,
    minPoolSize: 0,
    maxIdleTimeMS: 60_000,
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
