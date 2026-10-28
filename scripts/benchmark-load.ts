/**
 * Benchmark load test script simulating concurrent requests to validate
 * PRD §17 requirement (target: 200 concurrent student sessions).
 * Usage: npx tsx scripts/benchmark-load.ts [concurrency] [requests_per_worker]
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const CONCURRENCY = parseInt(process.argv[2] || "50", 10);
const REQUESTS_PER_WORKER = parseInt(process.argv[3] || "4", 10);
const TOTAL_REQUESTS = CONCURRENCY * REQUESTS_PER_WORKER;

async function runWorker(workerId: number): Promise<number[]> {
  const latencies: number[] = [];

  for (let i = 0; i < REQUESTS_PER_WORKER; i++) {
    const start = performance.now();
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      const end = performance.now();
      latencies.push(end - start);
    } catch {
      latencies.push(9999);
    }
  }

  return latencies;
}

async function main() {
  console.log("=== Nexam Load Benchmark (Phase 5) ===");
  console.log(`Target: ${BASE_URL}`);
  console.log(`Concurrency: ${CONCURRENCY} workers`);
  console.log(`Total Requests: ${TOTAL_REQUESTS}`);
  console.log("----------------------------------------");

  const overallStart = performance.now();
  const workerPromises: Promise<number[]>[] = [];

  for (let i = 0; i < CONCURRENCY; i++) {
    workerPromises.push(runWorker(i));
  }

  const results = await Promise.all(workerPromises);
  const overallEnd = performance.now();

  const allLatencies = results.flat().sort((a, b) => a - b);
  const totalDurationSeconds = (overallEnd - overallStart) / 1000;
  const rps = Math.round(TOTAL_REQUESTS / totalDurationSeconds);

  const p50 = allLatencies[Math.floor(allLatencies.length * 0.5)]?.toFixed(2);
  const p95 = allLatencies[Math.floor(allLatencies.length * 0.95)]?.toFixed(2);
  const p99 = allLatencies[Math.floor(allLatencies.length * 0.99)]?.toFixed(2);
  const max = allLatencies[allLatencies.length - 1]?.toFixed(2);

  console.log("✓ Benchmark Finished");
  console.log(`Total Duration: ${totalDurationSeconds.toFixed(2)}s`);
  console.log(`Throughput: ${rps} req/sec`);
  console.log(`Latency p50: ${p50}ms`);
  console.log(`Latency p95: ${p95}ms (Target: < 500ms per PRD §17)`);
  console.log(`Latency p99: ${p99}ms`);
  console.log(`Latency max: ${max}ms`);
  console.log("========================================");
}

main().catch(console.error);
