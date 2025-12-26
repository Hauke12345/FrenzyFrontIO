/**
 * Performance Logger - Automatically collects and saves performance data to a file
 * 
 * Usage:
 *   - Enable via console: PerformanceLogger.enable()
 *   - Disable via console: PerformanceLogger.disable()
 *   - Manual download: PerformanceLogger.download()
 *   - Auto-download every N seconds: PerformanceLogger.setAutoDownload(30)
 */

interface PerformanceSample {
  timestamp: number;
  fps: number;
  frameTime: number;
  layers: Record<string, number>;
  tickExecution?: number;
  tickDelay?: number;
}

class PerformanceLoggerClass {
  private enabled: boolean = false;
  private samples: PerformanceSample[] = [];
  private maxSamples: number = 3600; // ~1 minute at 60fps
  private autoDownloadInterval: number | null = null;
  private sessionStart: number = 0;
  private lastFps: number = 0;
  private lastFrameTime: number = 0;
  private lastTickExecution: number = 0;
  private lastTickDelay: number = 0;

  /**
   * Enable performance logging
   */
  enable(): void {
    if (this.enabled) {
      console.log('[PerformanceLogger] Already enabled');
      return;
    }
    this.enabled = true;
    this.samples = [];
    this.sessionStart = Date.now();
    console.log('[PerformanceLogger] Enabled - collecting performance data');
    console.log('[PerformanceLogger] Commands:');
    console.log('  PerformanceLogger.download() - Download data now');
    console.log('  PerformanceLogger.setAutoDownload(seconds) - Auto-download interval');
    console.log('  PerformanceLogger.disable() - Stop logging');
    console.log('  PerformanceLogger.summary() - Print summary to console');
  }

  /**
   * Disable performance logging
   */
  disable(): void {
    this.enabled = false;
    if (this.autoDownloadInterval !== null) {
      clearInterval(this.autoDownloadInterval);
      this.autoDownloadInterval = null;
    }
    console.log('[PerformanceLogger] Disabled');
  }

  /**
   * Check if logging is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Record a frame's performance data
   */
  recordFrame(fps: number, frameTime: number, layers: Record<string, number>): void {
    if (!this.enabled) return;

    this.lastFps = fps;
    this.lastFrameTime = frameTime;

    const sample: PerformanceSample = {
      timestamp: Date.now() - this.sessionStart,
      fps,
      frameTime,
      layers: { ...layers },
      tickExecution: this.lastTickExecution,
      tickDelay: this.lastTickDelay,
    };

    this.samples.push(sample);

    // Limit memory usage
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }

  /**
   * Record tick metrics
   */
  recordTick(executionTime: number, delay: number): void {
    if (!this.enabled) return;
    this.lastTickExecution = executionTime;
    this.lastTickDelay = delay;
  }

  /**
   * Set auto-download interval (in seconds)
   */
  setAutoDownload(seconds: number): void {
    if (this.autoDownloadInterval !== null) {
      clearInterval(this.autoDownloadInterval);
    }
    if (seconds > 0) {
      this.autoDownloadInterval = window.setInterval(() => {
        this.download();
      }, seconds * 1000);
      console.log(`[PerformanceLogger] Auto-download enabled every ${seconds} seconds`);
    } else {
      this.autoDownloadInterval = null;
      console.log('[PerformanceLogger] Auto-download disabled');
    }
  }

  /**
   * Get aggregated statistics
   */
  getStats(): {
    duration: number;
    sampleCount: number;
    avgFps: number;
    minFps: number;
    maxFps: number;
    avgFrameTime: number;
    maxFrameTime: number;
    layerStats: Record<string, { avg: number; max: number; total: number }>;
  } {
    if (this.samples.length === 0) {
      return {
        duration: 0,
        sampleCount: 0,
        avgFps: 0,
        minFps: 0,
        maxFps: 0,
        avgFrameTime: 0,
        maxFrameTime: 0,
        layerStats: {},
      };
    }

    const fpsValues = this.samples.map(s => s.fps);
    const frameTimeValues = this.samples.map(s => s.frameTime);
    
    // Aggregate layer stats
    const layerTotals: Record<string, { sum: number; max: number; count: number }> = {};
    for (const sample of this.samples) {
      for (const [layer, time] of Object.entries(sample.layers)) {
        if (!layerTotals[layer]) {
          layerTotals[layer] = { sum: 0, max: 0, count: 0 };
        }
        layerTotals[layer].sum += time;
        layerTotals[layer].max = Math.max(layerTotals[layer].max, time);
        layerTotals[layer].count++;
      }
    }

    const layerStats: Record<string, { avg: number; max: number; total: number }> = {};
    for (const [layer, data] of Object.entries(layerTotals)) {
      layerStats[layer] = {
        avg: data.sum / data.count,
        max: data.max,
        total: data.sum,
      };
    }

    return {
      duration: this.samples[this.samples.length - 1].timestamp,
      sampleCount: this.samples.length,
      avgFps: fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length,
      minFps: Math.min(...fpsValues),
      maxFps: Math.max(...fpsValues),
      avgFrameTime: frameTimeValues.reduce((a, b) => a + b, 0) / frameTimeValues.length,
      maxFrameTime: Math.max(...frameTimeValues),
      layerStats,
    };
  }

  /**
   * Print summary to console
   */
  summary(): void {
    const stats = this.getStats();
    console.log('\n=== Performance Summary ===');
    console.log(`Duration: ${(stats.duration / 1000).toFixed(1)}s`);
    console.log(`Samples: ${stats.sampleCount}`);
    console.log(`FPS: avg=${stats.avgFps.toFixed(1)}, min=${stats.minFps}, max=${stats.maxFps}`);
    console.log(`Frame Time: avg=${stats.avgFrameTime.toFixed(2)}ms, max=${stats.maxFrameTime.toFixed(2)}ms`);
    console.log('\nLayer Breakdown (sorted by total time):');
    
    const sortedLayers = Object.entries(stats.layerStats)
      .sort((a, b) => b[1].total - a[1].total);
    
    for (const [layer, data] of sortedLayers) {
      console.log(`  ${layer}: avg=${data.avg.toFixed(2)}ms, max=${data.max.toFixed(2)}ms, total=${data.total.toFixed(0)}ms`);
    }
    console.log('===========================\n');
  }

  /**
   * Download performance data as JSON file
   */
  download(): void {
    const stats = this.getStats();
    const data = {
      exportedAt: new Date().toISOString(),
      sessionStart: new Date(this.sessionStart).toISOString(),
      summary: stats,
      samples: this.samples,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log(`[PerformanceLogger] Downloaded ${this.samples.length} samples`);
  }

  /**
   * Download as CSV for easy analysis in spreadsheets
   */
  downloadCSV(): void {
    if (this.samples.length === 0) {
      console.log('[PerformanceLogger] No samples to export');
      return;
    }

    // Get all unique layer names
    const allLayers = new Set<string>();
    for (const sample of this.samples) {
      for (const layer of Object.keys(sample.layers)) {
        allLayers.add(layer);
      }
    }
    const layerNames = Array.from(allLayers).sort();

    // Build CSV
    const headers = ['timestamp', 'fps', 'frameTime', 'tickExecution', 'tickDelay', ...layerNames];
    const rows = [headers.join(',')];

    for (const sample of this.samples) {
      const row = [
        sample.timestamp,
        sample.fps,
        sample.frameTime.toFixed(2),
        sample.tickExecution?.toFixed(2) ?? '',
        sample.tickDelay?.toFixed(2) ?? '',
        ...layerNames.map(l => (sample.layers[l] ?? 0).toFixed(2)),
      ];
      rows.push(row.join(','));
    }

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-log-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log(`[PerformanceLogger] Downloaded CSV with ${this.samples.length} samples`);
  }
}

// Singleton instance
export const PerformanceLogger = new PerformanceLoggerClass();

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).PerformanceLogger = PerformanceLogger;
}
