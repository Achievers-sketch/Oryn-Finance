'use strict';

/**
 * Collects latency, throughput, and error metrics during protocol stress scenarios.
 * Issue #172: Protocol Stress Testing Framework
 */
class StressMetrics {
  constructor(name) {
    this.name = name;
    this.samples = [];
    this.errors = [];
    this.startTime = null;
    this.endTime = null;
  }

  start() {
    this.startTime = Date.now();
  }

  end() {
    this.endTime = Date.now();
  }

  record(operation, durationMs, success = true) {
    this.samples.push({ operation, durationMs, success, timestamp: Date.now() });
  }

  recordError(operation, error) {
    this.errors.push({
      operation,
      message: error?.message || String(error),
      timestamp: Date.now(),
    });
    this.samples.push({
      operation,
      durationMs: 0,
      success: false,
      timestamp: Date.now(),
    });
  }

  get durationMs() {
    if (this.startTime == null || this.endTime == null) return 0;
    return this.endTime - this.startTime;
  }

  get totalOperations() {
    return this.samples.length;
  }

  get successCount() {
    return this.samples.filter((s) => s.success).length;
  }

  get errorCount() {
    return this.samples.filter((s) => !s.success).length;
  }

  get errorRate() {
    if (this.totalOperations === 0) return 0;
    return this.errorCount / this.totalOperations;
  }

  get throughputOpsPerSec() {
    const durationSec = this.durationMs / 1000;
    if (durationSec <= 0) return this.successCount;
    return this.successCount / durationSec;
  }

  percentile(p) {
    if (this.samples.length === 0) return 0;
    const sorted = [...this.samples].sort((a, b) => a.durationMs - b.durationMs);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)].durationMs;
  }

  get p50() {
    return this.percentile(50);
  }

  get p95() {
    return this.percentile(95);
  }

  get p99() {
    return this.percentile(99);
  }

  toReport() {
    return {
      name: this.name,
      durationMs: this.durationMs,
      totalOperations: this.totalOperations,
      successCount: this.successCount,
      errorCount: this.errorCount,
      errorRate: Number(this.errorRate.toFixed(4)),
      throughputOpsPerSec: Number(this.throughputOpsPerSec.toFixed(2)),
      latencyMs: {
        p50: this.p50,
        p95: this.p95,
        p99: this.p99,
      },
    };
  }

  assertThresholds(thresholds = {}) {
    const report = this.toReport();
    const failures = [];

    if (thresholds.maxErrorRate != null && report.errorRate > thresholds.maxErrorRate) {
      failures.push(`errorRate ${report.errorRate} exceeds max ${thresholds.maxErrorRate}`);
    }
    if (thresholds.minThroughput != null && report.throughputOpsPerSec < thresholds.minThroughput) {
      failures.push(
        `throughput ${report.throughputOpsPerSec} below min ${thresholds.minThroughput}`
      );
    }
    if (thresholds.maxP95LatencyMs != null && report.latencyMs.p95 > thresholds.maxP95LatencyMs) {
      failures.push(`p95 latency ${report.latencyMs.p95}ms exceeds max ${thresholds.maxP95LatencyMs}ms`);
    }

    if (failures.length > 0) {
      throw new Error(`Stress thresholds failed for "${this.name}": ${failures.join('; ')}`);
    }

    return report;
  }
}

module.exports = StressMetrics;
