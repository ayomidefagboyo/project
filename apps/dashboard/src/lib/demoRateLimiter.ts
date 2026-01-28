/**
 * Demo Rate Limiter for OCR functionality
 * Prevents abuse of the demo API by limiting requests per user
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

interface GlobalRateLimit {
  minuteCount: number;
  minuteReset: number;
  hourCount: number;
  hourReset: number;
  dayCount: number;
  dayReset: number;
}

class DemoRateLimiter {
  private storageKey = 'compazz_demo_rate_limit';
  private globalStorageKey = 'compazz_demo_global_limit';

  // Website-based limits (much stricter than API limits)
  private maxRequestsPerUser = 3; // Per user per day
  private maxRequestsPerMinute = 2; // Global across all users
  private maxRequestsPerHour = 10; // Global across all users
  private maxRequestsPerDay = 30; // Global across all website visitors

  private userResetPeriod = 24 * 60 * 60 * 1000; // 24 hours
  private minuteResetPeriod = 60 * 1000; // 1 minute
  private hourResetPeriod = 60 * 60 * 1000; // 1 hour
  private dayResetPeriod = 24 * 60 * 60 * 1000; // 24 hours

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

  private getGlobalData(): GlobalRateLimit {
    try {
      const stored = localStorage.getItem(this.globalStorageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Handle storage errors gracefully
    }

    // Return default global data
    const now = Date.now();
    return {
      minuteCount: 0,
      minuteReset: now + this.minuteResetPeriod,
      hourCount: 0,
      hourReset: now + this.hourResetPeriod,
      dayCount: 0,
      dayReset: now + this.dayResetPeriod
    };
  }

  private setGlobalData(data: GlobalRateLimit): void {
    try {
      localStorage.setItem(this.globalStorageKey, JSON.stringify(data));
    } catch {
      // Handle storage errors gracefully
    }
  }

  private isWithinTimeWindow(timestamp: number, windowMs: number): boolean {
    return Date.now() - timestamp < windowMs;
  }

  /**
   * Check if the user can make an OCR request (website-based rate limiting)
   * @returns { allowed: boolean, reason?: string, retryAfter?: number }
   */
  checkRateLimit(): {
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
    remainingRequests?: number;
  } {
    const now = Date.now();

    // Check global limits first (protect API quota)
    const globalData = this.getGlobalData();

    // Reset global counters if time windows expired
    if (now > globalData.minuteReset) {
      globalData.minuteCount = 0;
      globalData.minuteReset = now + this.minuteResetPeriod;
    }
    if (now > globalData.hourReset) {
      globalData.hourCount = 0;
      globalData.hourReset = now + this.hourResetPeriod;
    }
    if (now > globalData.dayReset) {
      globalData.dayCount = 0;
      globalData.dayReset = now + this.dayResetPeriod;
    }

    // Check global minute limit
    if (globalData.minuteCount >= this.maxRequestsPerMinute) {
      return {
        allowed: false,
        reason: `Demo is busy right now. Please try again in a minute.`,
        retryAfter: globalData.minuteReset
      };
    }

    // Check global hour limit
    if (globalData.hourCount >= this.maxRequestsPerHour) {
      return {
        allowed: false,
        reason: `Demo usage limit reached for this hour. Try again later or sign up for unlimited access.`,
        retryAfter: globalData.hourReset
      };
    }

    // Check global day limit
    if (globalData.dayCount >= this.maxRequestsPerDay) {
      return {
        allowed: false,
        reason: `Daily demo limit reached. Try again tomorrow or sign up for unlimited access.`,
        retryAfter: globalData.dayReset
      };
    }

    // Check per-user limits
    const userData = this.getStoredData();

    if (userData) {
      // Reset user data if it's a new day
      const daysSinceFirst = Math.floor((now - userData.firstRequest) / this.userResetPeriod);
      if (daysSinceFirst === 0 && userData.count >= this.maxRequestsPerUser) {
        const resetTime = userData.firstRequest + this.userResetPeriod;
        return {
          allowed: false,
          reason: `You've used your ${this.maxRequestsPerUser} free demo tries today. Sign up for unlimited access!`,
          retryAfter: resetTime
        };
      }

      // Reset if new day
      if (daysSinceFirst > 0) {
        this.setStoredData({
          count: 1,
          resetTime: now + this.userResetPeriod,
          firstRequest: now
        });
      } else {
        // Update user count
        this.setStoredData({
          count: userData.count + 1,
          resetTime: userData.resetTime,
          firstRequest: userData.firstRequest
        });
      }
    } else {
      // First time user
      this.setStoredData({
        count: 1,
        resetTime: now + this.userResetPeriod,
        firstRequest: now
      });
    }

    // Update global counters
    globalData.minuteCount++;
    globalData.hourCount++;
    globalData.dayCount++;
    this.setGlobalData(globalData);

    const remaining = this.maxRequestsPerUser - (userData?.count || 0);
    return {
      allowed: true,
      remainingRequests: Math.max(0, remaining)
    };
  }

  /**
   * Get remaining time until rate limit resets
   */
  getTimeUntilReset(): number {
    const userData = this.getStoredData();
    if (!userData) return 0;

    return Math.max(0, userData.resetTime - Date.now());
  }

  /**
   * Get user's current usage stats
   */
  getUsageStats(): {
    userUsed: number;
    userLimit: number;
    globalMinuteUsed: number;
    globalMinuteLimit: number;
    globalHourUsed: number;
    globalHourLimit: number;
    globalDayUsed: number;
    globalDayLimit: number;
    userResetTime: number;
  } {
    const userData = this.getStoredData();
    const globalData = this.getGlobalData();
    const now = Date.now();

    return {
      userUsed: userData?.count || 0,
      userLimit: this.maxRequestsPerUser,
      globalMinuteUsed: now > globalData.minuteReset ? 0 : globalData.minuteCount,
      globalMinuteLimit: this.maxRequestsPerMinute,
      globalHourUsed: now > globalData.hourReset ? 0 : globalData.hourCount,
      globalHourLimit: this.maxRequestsPerHour,
      globalDayUsed: now > globalData.dayReset ? 0 : globalData.dayCount,
      globalDayLimit: this.maxRequestsPerDay,
      userResetTime: userData?.resetTime || now + this.userResetPeriod
    };
  }

  /**
   * Clear rate limit data (for testing or admin purposes)
   */
  clearRateLimit(): void {
    try {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.globalStorageKey);
    } catch {
      // Handle storage errors gracefully
    }
  }

  /**
   * Get a friendly message about current limits
   */
  getLimitMessage(): string {
    const stats = this.getUsageStats();
    const userRemaining = stats.userLimit - stats.userUsed;

    if (userRemaining <= 0) {
      return "You've used all your demo tries today. Sign up for unlimited access!";
    }

    return `You have ${userRemaining} demo ${userRemaining === 1 ? 'try' : 'tries'} left today.`;
  }
}

export const demoRateLimiter = new DemoRateLimiter();
