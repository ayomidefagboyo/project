/**
 * Demo Rate Limiter for OCR functionality
 * Prevents abuse of the demo API by limiting requests per user
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

class DemoRateLimiter {
  private storageKey = 'compazz_demo_rate_limit';
  private maxRequestsPerHour = 5;
  private maxRequestsPerDay = 15;
  private cooldownPeriod = 60 * 60 * 1000; // 1 hour in milliseconds
  private dailyResetPeriod = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  private getStoredData(): RateLimitEntry | null {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  private setStoredData(data: RateLimitEntry): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch {
      // Handle storage errors gracefully
    }
  }

  private isWithinTimeWindow(timestamp: number, windowMs: number): boolean {
    return Date.now() - timestamp < windowMs;
  }

  /**
   * Check if the user can make an OCR request
   * @returns { allowed: boolean, reason?: string, retryAfter?: number }
   */
  checkRateLimit(): { 
    allowed: boolean; 
    reason?: string; 
    retryAfter?: number;
    remainingRequests?: number;
  } {
    const now = Date.now();
    const stored = this.getStoredData();

    // First time user
    if (!stored) {
      this.setStoredData({
        count: 1,
        resetTime: now + this.cooldownPeriod,
        firstRequest: now
      });
      return { 
        allowed: true, 
        remainingRequests: this.maxRequestsPerHour - 1 
      };
    }

    // Check if daily limit exceeded
    const daysSinceFirst = Math.floor((now - stored.firstRequest) / this.dailyResetPeriod);
    if (daysSinceFirst === 0 && stored.count >= this.maxRequestsPerDay) {
      const resetTime = stored.firstRequest + this.dailyResetPeriod;
      return {
        allowed: false,
        reason: `Daily demo limit reached (${this.maxRequestsPerDay} requests). Try again tomorrow or sign up for unlimited access.`,
        retryAfter: resetTime
      };
    }

    // Reset daily counter if it's a new day
    if (daysSinceFirst > 0) {
      this.setStoredData({
        count: 1,
        resetTime: now + this.cooldownPeriod,
        firstRequest: now
      });
      return { 
        allowed: true, 
        remainingRequests: this.maxRequestsPerHour - 1 
      };
    }

    // Check hourly limit
    if (this.isWithinTimeWindow(stored.resetTime - this.cooldownPeriod, this.cooldownPeriod)) {
      const hourlyCount = this.getHourlyCount(stored);
      if (hourlyCount >= this.maxRequestsPerHour) {
        return {
          allowed: false,
          reason: `Hourly demo limit reached (${this.maxRequestsPerHour} requests). Please wait or sign up for unlimited access.`,
          retryAfter: stored.resetTime
        };
      }
    }

    // Allow request and update counter
    const updatedData: RateLimitEntry = {
      count: stored.count + 1,
      resetTime: this.isWithinTimeWindow(stored.resetTime - this.cooldownPeriod, this.cooldownPeriod) 
        ? stored.resetTime 
        : now + this.cooldownPeriod,
      firstRequest: stored.firstRequest
    };

    this.setStoredData(updatedData);

    const hourlyCount = this.getHourlyCount(updatedData);
    return { 
      allowed: true, 
      remainingRequests: this.maxRequestsPerHour - hourlyCount 
    };
  }

  private getHourlyCount(stored: RateLimitEntry): number {
    const now = Date.now();
    if (this.isWithinTimeWindow(stored.resetTime - this.cooldownPeriod, this.cooldownPeriod)) {
      // Count requests within current hour window
      return Math.min(stored.count, this.maxRequestsPerHour);
    }
    return 0;
  }

  /**
   * Get remaining time until rate limit resets
   */
  getTimeUntilReset(): number {
    const stored = this.getStoredData();
    if (!stored) return 0;
    
    return Math.max(0, stored.resetTime - Date.now());
  }

  /**
   * Get user's current usage stats
   */
  getUsageStats(): {
    hourlyUsed: number;
    hourlyLimit: number;
    dailyUsed: number;
    dailyLimit: number;
    resetTime: number;
  } {
    const stored = this.getStoredData();
    if (!stored) {
      return {
        hourlyUsed: 0,
        hourlyLimit: this.maxRequestsPerHour,
        dailyUsed: 0,
        dailyLimit: this.maxRequestsPerDay,
        resetTime: Date.now() + this.cooldownPeriod
      };
    }

    return {
      hourlyUsed: this.getHourlyCount(stored),
      hourlyLimit: this.maxRequestsPerHour,
      dailyUsed: stored.count,
      dailyLimit: this.maxRequestsPerDay,
      resetTime: stored.resetTime
    };
  }

  /**
   * Clear rate limit data (for testing or admin purposes)
   */
  clearRateLimit(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // Handle storage errors gracefully
    }
  }
}

export const demoRateLimiter = new DemoRateLimiter();
