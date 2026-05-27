import { Injectable, signal } from '@angular/core';

import { ThemeSettings } from '../models/website.models';
import { defaultThemeSettings } from './website-data.service';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly settings = signal<ThemeSettings>(defaultThemeSettings);
  readonly isDark = signal(false);

  applySettings(settings: ThemeSettings): void {
    this.settings.set(settings);
    const savedMode = localStorage.getItem('dysi-theme-mode') as ThemeSettings['themeMode'] | null;
    const mode = savedMode ?? settings.themeMode;
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const isDark = mode === 'dark' || (mode === 'auto' && prefersDark);

    this.isDark.set(isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.documentElement.style.setProperty('--primary', settings.primaryColor);
    document.documentElement.style.setProperty('--secondary', settings.secondaryColor);
    document.documentElement.style.setProperty('--bg', settings.backgroundColor);
    document.documentElement.style.setProperty('--text', settings.textColor);
    document.documentElement.style.setProperty('--button-color', settings.buttonColor);
    document.documentElement.style.setProperty('--app-font-family', settings.fontFamily);
    document.documentElement.style.setProperty('--app-font-size', settings.fontSize);
    document.documentElement.style.setProperty('--app-font-weight', settings.fontWeight);
    document.documentElement.style.setProperty('--app-letter-spacing', settings.letterSpacing);
    document.documentElement.style.setProperty('--app-line-height', settings.lineHeight);
    document.documentElement.style.setProperty('--section-spacing', settings.sectionSpacing);
    document.documentElement.style.setProperty('--radius', settings.borderRadius);
    document.documentElement.style.setProperty('--shadow-md', settings.cardShadow);
    document.documentElement.style.setProperty('--container-width', settings.containerWidth);
    document.documentElement.style.setProperty(
      '--gradient-primary',
      `linear-gradient(135deg, ${settings.primaryColor}, ${settings.secondaryColor})`,
    );
  }

  toggleTheme(): void {
    const nextMode = this.isDark() ? 'light' : 'dark';
    localStorage.setItem('dysi-theme-mode', nextMode);
    this.applySettings({ ...this.settings(), themeMode: nextMode });
  }
}
