import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WebsiteDataService } from '../../core/services/website-data.service';
import { TenantResolverService } from '../../core/services/tenant-resolver.service';
import { SiteConfig } from '../../core/models/tenant.models';

@Component({
  selector: 'app-site-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './site-settings.component.html',
  styleUrls: ['./site-settings.component.scss']
})
export class SiteSettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly websiteData = inject(WebsiteDataService);
  private readonly tenantResolver = inject(TenantResolverService);

  readonly currentSite = signal<SiteConfig | null>(null);
  readonly statusMessage = signal('');
  readonly errorMessage = signal('');
  readonly isSaving = signal(false);

  form = this.fb.group({
    siteName: ['', [Validators.required]],
    siteType: ['subdomain' as 'subdomain' | 'custom-domain', [Validators.required]],
    identifier: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.websiteData.userSite$.subscribe((site) => {
      if (site) {
        this.currentSite.set(site);
        this.form.patchValue({
          siteName: site.siteName,
          siteType: site.siteType,
          identifier: site.siteType === 'custom-domain' ? (site.domain || '') : (site.subdomain || ''),
        });
      }
    });
  }

  get siteType(): 'subdomain' | 'custom-domain' {
    return this.form.controls.siteType.value || 'subdomain';
  }

  get publicUrl(): string {
    const site = this.currentSite();
    if (!site) return '';
    if (site.siteType === 'subdomain') {
      return `https://dysi.web.app/${site.normalizedSubdomain || site.subdomain}`;
    } else {
      return `https://${site.normalizedDomain || site.domain}`;
    }
  }

  async saveSiteSettings(): Promise<void> {
    this.statusMessage.set('');
    this.errorMessage.set('');

    const site = this.currentSite();
    if (!site?.id) {
      this.errorMessage.set('No active website configuration found.');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Please fill in all required website settings.');
      return;
    }

    const siteName = this.form.value.siteName || '';
    const rawIdentifier = this.form.value.identifier || '';
    const newSiteType = this.siteType;

    // Check identifier availability if changed
    const currentIdentifier = site.siteType === 'custom-domain' ? site.domain : site.subdomain;
    if (rawIdentifier !== currentIdentifier || newSiteType !== site.siteType) {
      const avail = await this.tenantResolver.checkIdentifierAvailable(
        rawIdentifier,
        newSiteType,
        site.id
      );
      if (!avail.available) {
        this.errorMessage.set(avail.reason || 'Requested domain or subdomain is not available.');
        return;
      }
    }

    this.isSaving.set(true);

    try {
      const subdomain = newSiteType === 'subdomain' ? rawIdentifier : null;
      const domain = newSiteType === 'custom-domain' ? rawIdentifier : null;

      await this.websiteData.updateSiteConfig({
        id: site.id,
        siteName,
        siteType: newSiteType,
        subdomain,
        domain,
        domainStatus: newSiteType === 'custom-domain' ? (site.domainStatus || 'PENDING') : 'ACTIVE'
      });

      this.isSaving.set(false);
      this.statusMessage.set('Website settings updated successfully.');
    } catch (err: any) {
      this.isSaving.set(false);
      console.error(err);
      this.errorMessage.set('Failed to update website settings.');
    }
  }
}
