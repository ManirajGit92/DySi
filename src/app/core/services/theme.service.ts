import { Injectable, signal } from '@angular/core';

import { ThemeSettings } from '../models/website.models';
import { defaultThemeSettings } from './website-data.service';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly settings = signal<ThemeSettings>(defaultThemeSettings);
  readonly isDark = signal(false);

  applySettings(settings: ThemeSettings): void {
    const normalizedSettings: ThemeSettings = {
      ...defaultThemeSettings,
      ...settings,
    };

    this.settings.set(normalizedSettings);
    const savedMode = localStorage.getItem('dysi-theme-mode') as ThemeSettings['themeMode'] | null;
    const mode = savedMode ?? normalizedSettings.themeMode;
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const isDark = mode === 'dark' || (mode === 'auto' && prefersDark);

    this.isDark.set(isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.documentElement.style.setProperty('--primary', normalizedSettings.primaryColor);
    document.documentElement.style.setProperty('--secondary', normalizedSettings.secondaryColor);
    document.documentElement.style.setProperty('--bg', normalizedSettings.backgroundColor);
    document.documentElement.style.setProperty('--text', normalizedSettings.textColor);
    document.documentElement.style.setProperty('--button-color', normalizedSettings.buttonColor);
    document.documentElement.style.setProperty('--app-font-family', normalizedSettings.fontFamily);
    document.documentElement.style.setProperty('--app-font-size', normalizedSettings.fontSize);
    document.documentElement.style.setProperty('--app-font-weight', normalizedSettings.fontWeight);
    document.documentElement.style.setProperty(
      '--app-letter-spacing',
      normalizedSettings.letterSpacing,
    );
    document.documentElement.style.setProperty('--app-line-height', normalizedSettings.lineHeight);
    document.documentElement.style.setProperty(
      '--section-spacing',
      normalizedSettings.sectionSpacing,
    );
    document.documentElement.style.setProperty('--radius', normalizedSettings.borderRadius);
    document.documentElement.style.setProperty('--shadow-md', normalizedSettings.cardShadow);
    document.documentElement.style.setProperty(
      '--container-width',
      normalizedSettings.containerWidth,
    );
    document.documentElement.style.setProperty(
      '--gradient-primary',
      `linear-gradient(135deg, ${normalizedSettings.primaryColor}, ${normalizedSettings.secondaryColor})`,
    );
  }

  toggleTheme(): void {
    const nextMode = this.isDark() ? 'light' : 'dark';
    localStorage.setItem('dysi-theme-mode', nextMode);
    this.applySettings({ ...this.settings(), themeMode: nextMode });
  }
}
