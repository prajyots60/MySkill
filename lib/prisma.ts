// Prisma Client setup with proper type extensions
import { PrismaClient } from "@prisma/client";
// Type extensions are automatically applied via the types/prisma-extensions.d.ts file

declare global {
  var prisma: PrismaClient | undefined;
}

// Create Prisma client with optimized settings for Neon
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: ["error", "warn"], // Removed 'query' to stop printing SQL queries in terminal
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
};

// Get or create the Prisma client instance
export const prisma = globalThis.prisma ?? prismaClientSingleton();

// In development, attach the client to the global object to prevent hot-reload issues
if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

// Graceful shutdown handling - only in Node.js environment (not Edge runtime)
if (
  process.env.NODE_ENV !== "production" &&
  typeof process !== "undefined" &&
  typeof process.on === "function"
) {
  process.on("SIGINT", async () => {
    await prisma.$disconnect();
    console.log("🛑 Prisma disconnected on SIGINT");
    process.exit(0);
  });
}

// Add production shutdown handler as well
if (process.env.NODE_ENV === "production") {
  process.on("SIGTERM", async () => {
    await prisma.$disconnect();
    console.log("🛑 Prisma disconnected on SIGTERM");
    process.exit(0);
  });
}

/**
 * Lightweight connection check
 * Returns true if connection is successful, false otherwise
 */
export async function checkDbConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error("⚡ Database connection check failed:", error);
    return false;
  }
}

/**
 * Retry DB connection during cold starts or Neon idle wakeups
 * retries: Number of attempts
 * delayMs: Milliseconds between attempts
 */
export async function retryDbConnection(
  retries = 5,
  delayMs = 3000
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const isConnected = await checkDbConnection();
    if (isConnected) {
      console.log(`✅ Connected to database (attempt ${attempt})`);
      return;
    }
    console.log(
      `⏳ Retry ${attempt}/${retries} - Waiting ${delayMs / 1000}s...`
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  console.error(
    "❌ Failed to connect to the database after multiple retries. Exiting..."
  );
  process.exit(1);
}

export default prisma;
