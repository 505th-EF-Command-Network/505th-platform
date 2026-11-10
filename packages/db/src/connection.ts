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
  cache.promise ??= mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10_000 }).catch((err) => {
    cache.promise = null;
    throw err;
  });
  return cache.promise;
}

export async function disconnectDb() {
  if (cache.promise) {
    await (await cache.promise).disconnect();
    cache.promise = null;
  }
}
