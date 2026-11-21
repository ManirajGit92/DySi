import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule, ViewportScroller } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { HeaderComponent } from '../../components/header/header';
import { FooterComponent } from '../../components/footer/footer';
import { DynamicSectionComponent } from '../../shared/dynamic-section/dynamic-section';
import { TenantResolverService } from '../../core/services/tenant-resolver.service';
import { WebsiteDataService } from '../../core/services/website-data.service';
import { ScrollService } from '../../core/services/scroll.service';
import { ThemeService } from '../../core/services/theme.service';
import {
  FooterSettings,
  HeaderSettings,
  MenuItem,
  WebsiteSection,
} from '../../core/models/website.models';
import { SiteConfig } from '../../core/models/tenant.models';
import {
  defaultFooterSettings,
  defaultHeaderSettings,
} from '../../core/services/website-data.service';

@Component({
  selector: 'app-public-site',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    HeaderComponent,
    FooterComponent,
    DynamicSectionComponent,
  ],
  templateUrl: './public-site.html',
  styleUrls: ['./public-site.scss'],
})
export class PublicSiteComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tenantResolver = inject(TenantResolverService);
  private readonly websiteData = inject(WebsiteDataService);
  private readonly viewportScroller = inject(ViewportScroller);
  readonly scrollService = inject(ScrollService);
  readonly themeService = inject(ThemeService);

  readonly isLoading = signal(true);
  readonly siteNotFound = signal(false);
  readonly isSiteRestricted = signal(false);
  readonly currentSite = signal<SiteConfig | null>(null);

  readonly menus = signal<MenuItem[]>([]);
  readonly sections = signal<WebsiteSection[]>([]);
  readonly footerSettings = signal<FooterSettings>(defaultFooterSettings);
  readonly headerSettings = signal<HeaderSettings>(defaultHeaderSettings);

  private readonly subscriptions = new Subscription();

  ngOnInit(): void {
    this.subscriptions.add(
      this.route.params.subscribe(async (params) => {
        const siteIdentifier = params['siteIdentifier'] || window.location.hostname;
        await this.loadTenantSite(siteIdentifier);
      })
    );

    this.subscriptions.add(
      this.websiteData.menus$.subscribe((menus) => this.menus.set(menus))
    );
    this.subscriptions.add(
      this.websiteData.sections$.subscribe((sections) => {
        this.sections.set(sections);
        this.isLoading.set(false);
      })
    );
    this.subscriptions.add(
      this.websiteData.themeSettings$.subscribe((settings) =>
        this.themeService.applySettings(settings)
      )
    );
    this.subscriptions.add(
      this.websiteData.footerSettings$.subscribe((settings) =>
        this.footerSettings.set(settings)
      )
    );
    this.subscriptions.add(
      this.websiteData.headerSettings$.subscribe((settings) =>
        this.headerSettings.set(settings)
      )
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.tenantResolver.setCurrentSite(null);
  }

  private async loadTenantSite(identifier: string): Promise<void> {
    this.isLoading.set(true);
    this.siteNotFound.set(false);
    this.isSiteRestricted.set(false);

    try {
      const site = await this.tenantResolver.resolveTenant(identifier);
      if (!site) {
        this.siteNotFound.set(true);
        this.isLoading.set(false);
        return;
      }

      if (site.status === 'restricted') {
        this.isSiteRestricted.set(true);
        this.isLoading.set(false);
        return;
      }

      this.currentSite.set(site);
    } catch (err) {
      console.error('Error resolving tenant site:', err);
      this.siteNotFound.set(true);
      this.isLoading.set(false);
    }
  }

  scrollToSection(sectionId: string): void {
    if (!sectionId) return;
    this.scrollService.scrollToSection(sectionId);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
