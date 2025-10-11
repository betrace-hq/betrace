// Browser JavaScript Profiler using Performance API
// Sends profiles to Pyroscope in pprof format

export class BrowserProfiler {
  private serverUrl: string;
  private appName: string;
  private tags: Record<string, string>;
  private isRunning = false;
  private profileInterval: number | null = null;
  private readonly sampleIntervalMs = 10000; // Sample every 10 seconds

  constructor(config: { serverUrl: string; appName: string; tags: Record<string, string> }) {
    this.serverUrl = config.serverUrl;
    this.appName = config.appName;
    this.tags = config.tags;
  }

  start(): void {
    if (this.isRunning) {
      console.warn('[BrowserProfiler] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[BrowserProfiler] Starting JavaScript profiling');

    // Start sampling performance data
    this.profileInterval = window.setInterval(() => {
      this.collectAndSendProfile();
    }, this.sampleIntervalMs);
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.profileInterval) {
      clearInterval(this.profileInterval);
      this.profileInterval = null;
    }
    console.log('[BrowserProfiler] Stopped JavaScript profiling');
  }

  private async collectAndSendProfile(): Promise<void> {
    try {
      // Collect performance entries
      const entries = performance.getEntriesByType('measure');
      const marks = performance.getEntriesByType('mark');

      // Build simple profile data from performance timeline
      const profileData = this.buildProfileData(entries, marks);

      if (profileData.samples.length === 0) {
        return; // No data to send
      }

      await this.sendProfile(profileData);
    } catch (error) {
      console.error('[BrowserProfiler] Failed to collect profile:', error);
    }
  }

  private buildProfileData(entries: PerformanceEntryList, marks: PerformanceEntryList) {
    const samples: { stack: string[]; value: number }[] = [];

    // Convert performance measures to profile samples
    entries.forEach((entry) => {
      if (entry.duration > 0) {
        samples.push({
          stack: ['browser', entry.name],
          value: Math.round(entry.duration * 1000), // Convert to microseconds
        });
      }
    });

    // Convert performance marks to profile samples
    marks.forEach((mark) => {
      samples.push({
        stack: ['browser', 'mark', mark.name],
        value: 1000, // 1ms default for marks
      });
    });

    return { samples };
  }

  private async sendProfile(profileData: { samples: { stack: string[]; value: number }[] }): Promise<void> {
    try {
      // Build query params for Pyroscope ingestion
      const params = new URLSearchParams({
        name: this.appName,
        from: Math.floor(Date.now() / 1000 - 10).toString(), // 10 seconds ago
        until: Math.floor(Date.now() / 1000).toString(),
        sampleRate: '100',
        spyName: 'browser',
        units: 'microseconds',
        ...this.tags,
      });

      // Convert samples to collapsed format (Pyroscope expects this for browser)
      const collapsed = profileData.samples
        .map((sample) => `${sample.stack.join(';')} ${sample.value}`)
        .join('\n');

      const response = await fetch(`${this.serverUrl}/ingest?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: collapsed,
      });

      if (!response.ok) {
        console.error('[BrowserProfiler] Failed to send profile:', response.status, await response.text());
      } else {
        console.log('[BrowserProfiler] Profile sent successfully');
      }
    } catch (error) {
      console.error('[BrowserProfiler] Failed to send profile:', error);
    }
  }
}
