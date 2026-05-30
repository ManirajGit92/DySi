import { CommonModule, ViewportScroller } from '@angular/common';
import { AfterViewInit, Component, HostListener, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';

import { FooterComponent } from './components/footer/footer';
import { HeaderComponent } from './components/header/header';
import {
  FooterSettings,
  HeaderSettings,
  MenuItem,
  WebsiteSection,
} from './core/models/website.models';
import { ScrollService } from './core/services/scroll.service';
import { ThemeService } from './core/services/theme.service';
import {
  WebsiteDataService,
  defaultFooterSettings,
  defaultHeaderSettings,
} from './core/services/website-data.service';
import { DynamicSectionComponent } from './shared/dynamic-section/dynamic-section';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    HeaderComponent,
    FooterComponent,
    DynamicSectionComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, AfterViewInit, OnDestroy {
  readonly isLoading = signal(true);
  readonly isLandingRoute = signal(true);
  readonly isAdminRoute = signal(false);
  readonly menus = signal<MenuItem[]>([]);
  readonly sections = signal<WebsiteSection[]>([]);
  readonly footerSettings = signal<FooterSettings>(defaultFooterSettings);
  readonly headerSettings = signal<HeaderSettings>(defaultHeaderSettings);

  private fadeObserver: IntersectionObserver | null = null;
  private readonly subscriptions = new Subscription();

  constructor(
    private readonly router: Router,
    private readonly viewportScroller: ViewportScroller,
    readonly scrollService: ScrollService,
    readonly themeService: ThemeService,
    private readonly websiteData: WebsiteDataService,
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.websiteData.menus$.subscribe((menus) => {
        // console.log('Updating menus in App component:====>', menus);
        this.menus.set(menus);
        window.setTimeout(() => this.refreshNavigationTargets());
      }),
    );
    this.subscriptions.add(
      this.websiteData.sections$.subscribe((sections) => {
        //  console.log('Updating sections in App component:====>', sections);
        this.sections.set(sections);
        window.setTimeout(() => {
          this.refreshNavigationTargets();
          this.initFadeObserver();
        });
        this.isLoading.set(false);
      }),
    );
    this.subscriptions.add(
      this.websiteData.themeSettings$.subscribe((settings) =>
        this.themeService.applySettings(settings),
      ),
    );
    this.subscriptions.add(
      this.websiteData.footerSettings$.subscribe((settings) => this.footerSettings.set(settings)),
    );
    this.subscriptions.add(
      this.websiteData.headerSettings$.subscribe((settings) => this.headerSettings.set(settings)),
    );
    this.subscriptions.add(
      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe(() => {
          const path = this.router.url.split('#')[0].split('?')[0];
          const fragment = this.router.parseUrl(this.router.url).fragment;
          const landing =
            path !== '/services' && path !== '/admin' && path !== '/test' && path !== '/bookTicket';
          const admin = path === '/admin';
          this.isLandingRoute.set(landing);
          this.isAdminRoute.set(admin);

          if (landing) {
            window.setTimeout(() => {
              this.initFadeObserver();
              if (fragment) {
                this.scrollToSection(fragment);
              }
            }, 80);
          }
        }),
    );

    window.setTimeout(() => this.isLoading.set(false), 1200);
  }

  ngAfterViewInit(): void {
    this.viewportScroller.setOffset([0, 86]);
    window.setTimeout(() => this.refreshNavigationTargets());
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.scrollService.setBackToTopVisibility();
  }

  scrollToSection(sectionId: string): void {
    if (!sectionId) {
      return;
    }

    if (!this.isLandingRoute()) {
      void this.router.navigate(['/'], { fragment: sectionId }).then(() => {
        window.setTimeout(() => this.scrollService.scrollToSection(sectionId), 120);
      });
      return;
    }

    this.scrollService.scrollToSection(sectionId);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  private initFadeObserver(): void {
    if (!('IntersectionObserver' in window)) {
      document
        .querySelectorAll('.reveal')
        .forEach((element) => element.classList.add('is-visible'));
      return;
    }

    this.fadeObserver?.disconnect();

    this.fadeObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            this.fadeObserver?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16 },
    );

    document.querySelectorAll('.reveal').forEach((element) => this.fadeObserver?.observe(element));
  }

  private refreshNavigationTargets(): void {
    const sectionIds = this.sections().map((section) => section.sectionId);
    const menuTargets = this.menus().map((menu) => menu.sectionId);
    this.scrollService.watchSections([...new Set([...sectionIds, ...menuTargets])]);
  }
}
