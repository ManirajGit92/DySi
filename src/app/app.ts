import { CommonModule, ViewportScroller } from '@angular/common';
import { AfterViewInit, Component, HostListener, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';

import { AboutComponent } from './components/about/about';
import { ContactComponent } from './components/contact/contact';
import { FeedbackComponent } from './components/feedback/feedback';
import { FooterComponent } from './components/footer/footer';
import { HeaderComponent } from './components/header/header';
import { HomeComponent } from './components/home/home';
import { ServicesComponent } from './components/services/services';
import { TeamComponent } from './components/team/team';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterOutlet,
    HeaderComponent,
    HomeComponent,
    AboutComponent,
    ServicesComponent,
    TeamComponent,
    FeedbackComponent,
    ContactComponent,
    FooterComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, AfterViewInit, OnDestroy {
  readonly isLoading = signal(true);
  readonly activeSection = signal('home');
  readonly showBackToTop = signal(false);
  readonly isDarkTheme = signal(false);
  readonly isLandingRoute = signal(true);

  private readonly sectionIds = ['home', 'about', 'services', 'team', 'feedback', 'contact'];
  private observer?: IntersectionObserver;
  private routerSub?: Subscription;

  constructor(
    private readonly router: Router,
    private readonly viewportScroller: ViewportScroller,
  ) {}

  ngOnInit(): void {
    const savedTheme = localStorage.getItem('dysi-theme');
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    this.setTheme(savedTheme ? savedTheme === 'dark' : prefersDark);

    window.setTimeout(() => this.isLoading.set(false), 900);

    this.routerSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        const fragment = this.router.parseUrl(this.router.url).fragment;
        this.isLandingRoute.set(this.router.url.split('#')[0].split('?')[0] !== '/services');
        if (fragment) {
          window.setTimeout(() => this.scrollToSection(fragment), 80);
        } else if (this.router.url === '/') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
  }

  ngAfterViewInit(): void {
    this.viewportScroller.setOffset([0, 82]);
    this.initSectionObserver();
    this.initFadeObserver();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.routerSub?.unsubscribe();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.showBackToTop.set(window.scrollY > 640);
  }

  scrollToSection(sectionId: string): void {
    if (!this.isLandingRoute()) {
      void this.router.navigate(['/'], { fragment: sectionId }).then(() => {
        window.setTimeout(() => this.scrollToSection(sectionId), 80);
      });
      return;
    }

    const section = document.getElementById(sectionId);
    if (!section) {
      return;
    }

    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.activeSection.set(sectionId);
    void this.router.navigate([], {
      fragment: sectionId,
      queryParamsHandling: 'preserve',
      replaceUrl: true,
    });
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.activeSection.set('home');
  }

  toggleTheme(): void {
    this.setTheme(!this.isDarkTheme());
  }

  private setTheme(isDark: boolean): void {
    this.isDarkTheme.set(isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('dysi-theme', isDark ? 'dark' : 'light');
  }

  private initSectionObserver(): void {
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

    this.sectionIds
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section))
      .forEach((section) => this.observer?.observe(section));
  }

  private initFadeObserver(): void {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-visible'));
      return;
    }

    const fadeObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            fadeObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 },
    );

    document.querySelectorAll('.reveal').forEach((element) => fadeObserver.observe(element));
  }
}
