import en from './locales/en.json';
import it from './locales/it.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import fr from './locales/fr.json';
import de from './locales/de.json';

export type SupportedLocale = 'en' | 'it' | 'es' | 'pt' | 'fr' | 'de';

const DICTIONARIES: Record<SupportedLocale, Record<string, string>> = {
  en,
  it,
  es,
  pt,
  fr,
  de
};

class I18nManagerClass {
  private currentLocale: SupportedLocale = 'en';

  public init(rawLang?: string | null): SupportedLocale {
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const forcedLang = urlParams?.get('lang');
    const candidate = (forcedLang || rawLang || 'en').toLowerCase().slice(0, 2);

    if (candidate in DICTIONARIES) {
      this.currentLocale = candidate as SupportedLocale;
    } else {
      this.currentLocale = 'en';
    }
    return this.currentLocale;
  }

  public setLocale(locale: SupportedLocale): void {
    if (locale in DICTIONARIES) {
      this.currentLocale = locale;
    }
  }

  public getLocale(): SupportedLocale {
    return this.currentLocale;
  }

  public t(key: string): string {
    return DICTIONARIES[this.currentLocale]?.[key] ?? DICTIONARIES.en[key] ?? key;
  }

  public getSupportedLocales(): SupportedLocale[] {
    return ['en', 'it', 'es', 'pt', 'fr', 'de'];
  }
}

export const I18n = new I18nManagerClass();
