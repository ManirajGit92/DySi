import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { SiteConfig } from '../models/tenant.models';

export const RESERVED_ROUTES = new Set([
  'admin',
  'super-admin',
  'login',
  'register',
  'forgot-password',
  'change-password',
  'services',
  'bookTicket',
  'add-feedback',
  'test',
  'api',
  'assets',
  'public',
  'home',
  'about',
  'contact',
  'team',
  'faq',
  'gallery',
  'bookings',
  'settings'
]);

@Injectable({ providedIn: 'root' })
export class TenantResolverService {
  private readonly firestore = inject(Firestore);

  private readonly currentSiteSubject = new BehaviorSubject<SiteConfig | null>(null);
  readonly currentSite$: Observable<SiteConfig | null> = this.currentSiteSubject.asObservable();

  private readonly currentOwnerUidSubject = new BehaviorSubject<string | null>(null);
  readonly currentOwnerUid$: Observable<string | null> = this.currentOwnerUidSubject.asObservable();

  normalizeDomain(domain: string | null | undefined): string {
    if (!domain) return '';
    let normalized = domain.trim().toLowerCase();
    normalized = normalized.replace(/^https?:\/\//i, '');
    normalized = normalized.replace(/\/.*$/, '');
    return normalized;
  }

  normalizeSubdomain(subdomain: string | null | undefined): string {
    if (!subdomain) return '';
    let normalized = subdomain.trim().toLowerCase();
    normalized = normalized.replace(/^https?:\/\//i, '');
    normalized = normalized.replace(/\/.*$/, '');
    normalized = normalized.replace(/[^a-z0-9-]/g, '');
    return normalized;
  }

  isValidSubdomainFormat(subdomain: string): boolean {
    const norm = this.normalizeSubdomain(subdomain);
    if (!norm || norm.length < 3 || norm.length > 50) return false;
    if (RESERVED_ROUTES.has(norm)) return false;
    return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(norm);
  }

  isValidDomainFormat(domain: string): boolean {
    const norm = this.normalizeDomain(domain);
    if (!norm || norm.length < 4 || norm.length > 100) return false;
    return /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(norm);
  }

  async checkIdentifierAvailable(
    identifier: string,
    type: 'subdomain' | 'custom-domain',
    excludeSiteId?: string
  ): Promise<{ available: boolean; reason?: string }> {
    if (type === 'subdomain') {
      const norm = this.normalizeSubdomain(identifier);
      if (!this.isValidSubdomainFormat(norm)) {
        return {
          available: false,
          reason: RESERVED_ROUTES.has(norm)
            ? 'This subdomain name is reserved by the system.'
            : 'Invalid subdomain format. Use 3-50 alphanumeric characters and hyphens.'
        };
      }
      const sitesRef = collection(this.firestore, 'sites');
      const q = query(sitesRef, where('normalizedSubdomain', '==', norm));
      const snap = await getDocs(q);
      const isTaken = snap.docs.some((d) => d.id !== excludeSiteId);
      if (isTaken) {
        return { available: false, reason: 'That subdomain is already in use.' };
      }
      return { available: true };
    } else {
      const norm = this.normalizeDomain(identifier);
      if (!this.isValidDomainFormat(norm)) {
        return { available: false, reason: 'Please enter a valid domain (e.g. mysite.com).' };
      }
      const sitesRef = collection(this.firestore, 'sites');
      const q = query(sitesRef, where('normalizedDomain', '==', norm));
      const snap = await getDocs(q);
      const isTaken = snap.docs.some((d) => d.id !== excludeSiteId);
      if (isTaken) {
        return { available: false, reason: 'That domain is already registered.' };
      }
      return { available: true };
    }
  }

  async resolveTenant(siteIdentifierOrHostname: string): Promise<SiteConfig | null> {
    if (!siteIdentifierOrHostname) return null;
    const sitesRef = collection(this.firestore, 'sites');

    // 1. Try subdomain resolution
    const normSub = this.normalizeSubdomain(siteIdentifierOrHostname);
    if (normSub && !RESERVED_ROUTES.has(normSub)) {
      const qSub = query(sitesRef, where('normalizedSubdomain', '==', normSub));
      const snapSub = await getDocs(qSub);
      if (!snapSub.empty) {
        const docSnap = snapSub.docs[0];
        const site = { id: docSnap.id, ...docSnap.data() } as SiteConfig;
        this.currentSiteSubject.next(site);
        this.currentOwnerUidSubject.next(site.ownerUid);
        return site;
      }
    }

    // 2. Try custom domain resolution
    const normDom = this.normalizeDomain(siteIdentifierOrHostname);
    if (normDom) {
      const qDom = query(sitesRef, where('normalizedDomain', '==', normDom));
      const snapDom = await getDocs(qDom);
      if (!snapDom.empty) {
        const docSnap = snapDom.docs[0];
        const site = { id: docSnap.id, ...docSnap.data() } as SiteConfig;
        this.currentSiteSubject.next(site);
        this.currentOwnerUidSubject.next(site.ownerUid);
        return site;
      }
    }

    this.currentSiteSubject.next(null);
    this.currentOwnerUidSubject.next(null);
    return null;
  }

  setCurrentSite(site: SiteConfig | null): void {
    this.currentSiteSubject.next(site);
    this.currentOwnerUidSubject.next(site ? site.ownerUid : null);
  }

  getCurrentSite(): SiteConfig | null {
    return this.currentSiteSubject.value;
  }

  getCurrentOwnerUid(): string | null {
    return this.currentOwnerUidSubject.value;
  }
}
