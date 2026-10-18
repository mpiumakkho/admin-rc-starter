import i18next from 'i18next';

describe('useLanguage', () => {
  /** The service as the app loads it, reading what this browser remembers */
  const load = async () => {
    vi.resetModules();
    return import('./language.service');
  };

  beforeEach(() => localStorage.clear());

  it('should start in the default language', async () => {
    const { DEFAULT_LANGUAGE, useLanguage } = await load();
    useLanguage.getState().init();

    expect(useLanguage.getState().current).toBe(DEFAULT_LANGUAGE);
    expect((await import('i18next')).default.language).toBe(DEFAULT_LANGUAGE);
    expect(document.documentElement.lang).toBe(DEFAULT_LANGUAGE);
  });

  it('should switch language and remember the choice', async () => {
    (await load()).useLanguage.getState().use('en');

    expect((await import('i18next')).default.language).toBe('en');
    expect(document.documentElement.lang).toBe('en');

    expect((await load()).useLanguage.getState().current).toBe('en');
  });

  it('should ignore a stored language that is not supported', async () => {
    localStorage.setItem('language', 'ar');

    const { DEFAULT_LANGUAGE, useLanguage } = await load();
    expect(useLanguage.getState().current).toBe(DEFAULT_LANGUAGE);
  });

  afterAll(() => void i18next.changeLanguage('en'));
});
