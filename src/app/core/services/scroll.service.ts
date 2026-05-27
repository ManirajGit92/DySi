import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class ScrollService {
  readonly activeSection = signal('home');
  readonly showBackToTop = signal(false);
  private observer?: IntersectionObserver;

  constructor(private readonly router: Router) {}

  watchSections(sectionIds: string[]): void {
    this.observer?.disconnect();

    if (!('IntersectionObserver' in window)) {
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.activeSection.set(entry.target.id);
          }
        });
      },
      { rootMargin: '-42% 0px -48% 0px', threshold: 0.01 },
    );

    sectionIds
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section))
      .forEach((section) => this.observer?.observe(section));
  }

  scrollToSection(sectionId: string): void {
    const section = document.getElementById(sectionId);
    if (!section) {
      return;
    }

    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.activeSection.set(sectionId);
    void this.router.navigate([], { fragment: sectionId, queryParamsHandling: 'preserve', replaceUrl: true });
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.activeSection.set('home');
  }

  setBackToTopVisibility(): void {
    this.showBackToTop.set(window.scrollY > 640);
  }
}
