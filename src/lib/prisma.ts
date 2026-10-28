import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is missing.");
  }
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

function getOrInitClient(): PrismaClient {
  const existing = globalForPrisma.prisma as any;
  // If the cached PrismaClient is stale (missing Phase 3 or Phase 4 models),
  // disconnect and discard it to instantiate a fresh client from newly generated artifacts.
  if (existing && (typeof existing.examinationAttempt === "undefined" || typeof existing.examinationEvent === "undefined")) {
    try {
      existing.$disconnect?.();
    } catch {
      // Ignore disconnect error on stale instance
    }
    globalForPrisma.prisma = undefined;
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}

// Proxy wrapper ensures that model property access is evaluated lazily at runtime.
// If the server process was running prior to prisma generate, the proxy guarantees
// that fresh model delegates (like examinationAttempt) are resolved rather than throwing undefined.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    const client = getOrInitClient();
    const value = Reflect.get(client, prop, client);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = globalForPrisma.prisma ?? createPrismaClient();
}

export default prisma;
