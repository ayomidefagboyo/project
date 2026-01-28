// Platform-wide currency service with location detection and settings override

interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  locale: string;
}

interface CurrencySettings {
  currency: string;
  lastUpdated: string;
}

// Currency mapping by country code
const CURRENCY_BY_COUNTRY: Record<string, CurrencyInfo> = {
  'US': { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US' },
  'CA': { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', locale: 'en-CA' },
  'GB': { code: 'GBP', name: 'British Pound', symbol: '£', locale: 'en-GB' },
  'DE': { code: 'EUR', name: 'Euro', symbol: '€', locale: 'de-DE' },
  'FR': { code: 'EUR', name: 'Euro', symbol: '€', locale: 'fr-FR' },
  'ES': { code: 'EUR', name: 'Euro', symbol: '€', locale: 'es-ES' },
  'IT': { code: 'EUR', name: 'Euro', symbol: '€', locale: 'it-IT' },
  'NG': { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', locale: 'en-NG' },
  'KE': { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', locale: 'en-KE' },
  'GH': { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵', locale: 'en-GH' },
  'ZA': { code: 'ZAR', name: 'South African Rand', symbol: 'R', locale: 'en-ZA' },
  'AU': { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', locale: 'en-AU' },
  'JP': { code: 'JPY', name: 'Japanese Yen', symbol: '¥', locale: 'ja-JP' },
  'IN': { code: 'INR', name: 'Indian Rupee', symbol: '₹', locale: 'en-IN' },
  'BR': { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', locale: 'pt-BR' },
  'MX': { code: 'MXN', name: 'Mexican Peso', symbol: '$', locale: 'es-MX' },
  'CN': { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', locale: 'zh-CN' },
  'RU': { code: 'RUB', name: 'Russian Ruble', symbol: '₽', locale: 'ru-RU' },
  'TR': { code: 'TRY', name: 'Turkish Lira', symbol: '₺', locale: 'tr-TR' },
  'EG': { code: 'EGP', name: 'Egyptian Pound', symbol: '£', locale: 'ar-EG' }
};

// Default currency fallback
const DEFAULT_CURRENCY: CurrencyInfo = {
  code: 'USD',
  name: 'US Dollar',
  symbol: '$',
  locale: 'en-US'
};

class CurrencyService {
  private settings: CurrencySettings | null = null;
  private detectedCurrency: CurrencyInfo | null = null;

  constructor() {
    this.loadSettings();
  }

  // Load currency settings from localStorage
  private loadSettings(): void {
    try {
      const stored = localStorage.getItem('currencySettings');
      if (stored) {
        this.settings = JSON.parse(stored);
      } else {
        this.settings = {
          currency: 'USD',
          lastUpdated: new Date().toISOString()
        };
        this.saveSettings();
      }
    } catch (error) {
      console.error('Failed to load currency settings:', error);
      this.settings = {
        currency: 'USD',
        lastUpdated: new Date().toISOString()
      };
    }
  }

  // Save currency settings to localStorage
  private saveSettings(): void {
    try {
      localStorage.setItem('currencySettings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save currency settings:', error);
    }
  }

  // Detect user's country from browser
  private async detectCountry(): Promise<string | null> {
    try {
      // Try geolocation API first (more reliable)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://ipapi.co/json/', {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.country_code && data.country_code !== 'XX') {
          console.log('Detected country:', data.country_code);
          return data.country_code;
        }
      }

      // Fallback: try to infer from timezone (limited accuracy)
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log('Timezone fallback:', timezone);

      // Simple timezone to country mapping for major regions
      const timezoneToCountry: Record<string, string> = {
        'America/New_York': 'US',
        'America/Los_Angeles': 'US',
        'America/Chicago': 'US',
        'America/Toronto': 'CA',
        'Europe/London': 'GB',
        'Europe/Berlin': 'DE',
        'Europe/Paris': 'FR',
        'Africa/Lagos': 'NG',
        'Africa/Nairobi': 'KE',
        'Asia/Tokyo': 'JP',
        'Asia/Shanghai': 'CN',
        'Asia/Kolkata': 'IN',
        'Australia/Sydney': 'AU'
      };

      return timezoneToCountry[timezone] || null;
    } catch (error) {
      console.log('Country detection failed, using default USD');
      return null;
    }
  }

  // Get currency info by code
  private getCurrencyInfo(code: string): CurrencyInfo {
    const currency = Object.values(CURRENCY_BY_COUNTRY).find(c => c.code === code);
    return currency || DEFAULT_CURRENCY;
  }

  // Initialize currency detection (only called once on app start)
  async initializeCurrency(): Promise<CurrencyInfo> {
    if (!this.settings) {
      this.loadSettings();
    }

    // Only detect if no currency is saved yet
    if (!this.settings?.currency || this.settings.currency === 'USD') {
      try {
        const country = await this.detectCountry();
        if (country && CURRENCY_BY_COUNTRY[country]) {
          this.detectedCurrency = CURRENCY_BY_COUNTRY[country];
          // Save the detected currency
          this.settings.currency = this.detectedCurrency.code;
          this.saveSettings();
          return this.detectedCurrency;
        }
      } catch (error) {
        console.log('Currency detection failed, using default');
      }
    }

    // Use saved currency or default
    const currencyCode = this.settings?.currency || 'USD';
    this.detectedCurrency = this.getCurrencyInfo(currencyCode);
    return this.detectedCurrency;
  }

  // Get current currency (no detection, just return saved or default)
  getCurrentCurrency(): CurrencyInfo {
    if (this.detectedCurrency) {
      return this.detectedCurrency;
    }
    
    // Load settings if not loaded
    if (!this.settings) {
      this.loadSettings();
    }
    
    const currencyCode = this.settings?.currency || 'USD';
    this.detectedCurrency = this.getCurrencyInfo(currencyCode);
    return this.detectedCurrency;
  }

  // Set currency manually
  setCurrency(currencyCode: string): void {
    if (!this.settings) {
      this.loadSettings();
    }

    this.settings = {
      ...this.settings!,
      currency: currencyCode,
      lastUpdated: new Date().toISOString()
    };

    this.detectedCurrency = this.getCurrencyInfo(currencyCode);
    this.saveSettings();
  }


  // Format currency amount
  formatCurrency(amount: number, options?: Intl.NumberFormatOptions): string {
    const currency = this.getCurrentCurrency();
    
    return new Intl.NumberFormat(currency.locale, {
      style: 'currency',
      currency: currency.code,
      ...options
    }).format(amount);
  }

  // Get all available currencies
  getAllCurrencies(): CurrencyInfo[] {
    const uniqueCurrencies = new Map();
    Object.values(CURRENCY_BY_COUNTRY).forEach(currency => {
      if (!uniqueCurrencies.has(currency.code)) {
        uniqueCurrencies.set(currency.code, currency);
      }
    });
    return Array.from(uniqueCurrencies.values());
  }

  // Get currency settings
  getSettings(): CurrencySettings | null {
    return this.settings;
  }

  // Reset to default
  resetToDefault(): void {
    this.settings = {
      currency: 'USD',
      lastUpdated: new Date().toISOString()
    };
    this.detectedCurrency = DEFAULT_CURRENCY;
    this.saveSettings();
  }
}

export const currencyService = new CurrencyService();
export type { CurrencyInfo, CurrencySettings };
