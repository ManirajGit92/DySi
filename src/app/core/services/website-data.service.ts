import { Injectable, inject } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  User,
  authState,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from '@angular/fire/auth';
import {
  Firestore,
  collection,
  collectionData,
  deleteDoc,
  doc,
  docData,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from '@angular/fire/firestore';
import { Storage, getDownloadURL, ref, uploadBytes } from '@angular/fire/storage';
import { Observable, BehaviorSubject, catchError, combineLatest, map, of, startWith, switchMap, tap } from 'rxjs';

import {
  FooterSettings,
  HeaderSettings,
  MenuItem,
  ThemeSettings,
  WebsiteSection,
} from '../models/website.models';
import { UserProfile, SiteConfig } from '../models/tenant.models';
import { TenantResolverService } from './tenant-resolver.service';

@Injectable({ providedIn: 'root' })
export class WebsiteDataService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly storage = inject(Storage);
  private readonly tenantResolver = inject(TenantResolverService);

  readonly user$: Observable<User | null> = authState(this.auth);

  readonly activeOwnerUid$: Observable<string | null> = combineLatest([
    this.user$.pipe(map((u) => u?.uid || null)),
    this.tenantResolver.currentOwnerUid$,
  ]).pipe(
    map(([authUid, publicOwnerUid]) => publicOwnerUid || authUid || null)
  );

  private readonly authInitialized = new BehaviorSubject<boolean>(false);
  readonly authInitialized$ = this.authInitialized.asObservable();

  readonly isRestricted$: Observable<boolean> = this.user$.pipe(
    switchMap((user) => {
      const email = user?.email;
      if (!email) return of(false);
      const docRef = doc(this.firestore, 'restricted_users', email);
      return docData(docRef).pipe(
        map((data) => !!data),
        catchError(() => of(false))
      );
    })
  );

  readonly isSuperAdmin$: Observable<boolean> = this.user$.pipe(
    switchMap((user) => {
      const email = user?.email;
      if (!email) return of(false);
      return this.isRestricted$.pipe(
        switchMap((isRestricted) => {
          if (isRestricted) return of(false);
          if (email === 'manirajmca.ac@gmail.com') return of(true);
          const docRef = doc(this.firestore, 'super_admin', email);
          return docData(docRef).pipe(
            map((data) => !!data),
            catchError(() => of(false))
          );
        })
      );
    })
  );

  readonly isAdmin$: Observable<boolean> = this.user$.pipe(
    switchMap((user) => {
      const email = user?.email;
      if (!email) return of(false);
      return this.isRestricted$.pipe(
        switchMap((isRestricted) => {
          if (isRestricted) return of(false);
          if (email === 'manirajmca.ac@gmail.com') return of(true);
          return this.isSuperAdmin$.pipe(
            switchMap((isSuperAdmin) => {
              if (isSuperAdmin) return of(true);
              const docRef = doc(this.firestore, 'admins', email);
              return docData(docRef).pipe(
                map((data) => !!data),
                catchError(() => of(false))
              );
            })
          );
        })
      );
    })
  );

  // Real-time lists for Super Admin page
  readonly allUsers$ = collectionData(collection(this.firestore, 'users'), { idField: 'id' }) as Observable<any[]>;
  readonly allAdmins$ = collectionData(collection(this.firestore, 'admins'), { idField: 'id' }) as Observable<any[]>;
  readonly allSuperAdmins$ = collectionData(collection(this.firestore, 'super_admin'), { idField: 'id' }) as Observable<any[]>;
  readonly allRestricted$ = collectionData(collection(this.firestore, 'restricted_users'), { idField: 'id' }) as Observable<any[]>;
  readonly allAllowed$ = collectionData(collection(this.firestore, 'allowed_users'), { idField: 'id' }) as Observable<any[]>;

  readonly usersWithRoles$: Observable<any[]> = combineLatest([
    this.allUsers$.pipe(startWith([])),
    this.allAdmins$.pipe(startWith([])),
    this.allSuperAdmins$.pipe(startWith([])),
    this.allRestricted$.pipe(startWith([])),
    this.allAllowed$.pipe(startWith([])),
  ]).pipe(
    map(([users, admins, superAdmins, restricted, allowed]) => {
      const adminEmails = new Set(admins.map((a) => a.id));
      const superAdminEmails = new Set(superAdmins.map((sa) => sa.id));
      const restrictedEmails = new Set(restricted.map((r) => r.id));
      const allowedEmails = new Set(allowed.map((al) => al.id));

      return users.map((user) => ({
        ...user,
        isAdmin: adminEmails.has(user.email) || user.email === 'manirajmca.ac@gmail.com',
        isSuperAdmin: superAdminEmails.has(user.email) || user.email === 'manirajmca.ac@gmail.com',
        isRestricted: restrictedEmails.has(user.email),
        isAllowed: allowedEmails.has(user.email) || !restrictedEmails.has(user.email),
      }));
    })
  );

  readonly accessControlLogs$ = collectionData(
    query(collection(this.firestore, 'access_control'), orderBy('timestamp', 'desc')),
    { idField: 'id' }
  ) as Observable<any[]>;

  readonly allAdminSectionsPermissions$ = collectionData(
    collection(this.firestore, 'admin_sections_permissions'),
    { idField: 'id' }
  ) as Observable<any[]>;

  readonly adminsWithPermissions$: Observable<any[]> = combineLatest([
    this.usersWithRoles$,
    this.allAdminSectionsPermissions$.pipe(startWith([]))
  ]).pipe(
    map(([users, allPermissions]) => {
      const permissionsMap = new Map(allPermissions.map((p) => [p.id, p.sections]));
      return users
        .filter(u => u.isAdmin)
        .map(u => {
          const sections = permissionsMap.get(u.email) || {
            dashboard: true,
            products: true,
            settings: true,
            users: true,
            analytics: true,
            bookings: true,
            'booking-settings': true
          };
          return {
            ...u,
            sections
          };
        });
    })
  );

  readonly userSectionsPermission$: Observable<Record<string, boolean>> = this.user$.pipe(
    switchMap(user => {
      const email = user?.email;
      if (!email) return of({});
      return this.isSuperAdmin$.pipe(
        switchMap(isSuper => {
          if (isSuper) {
            return of({
              dashboard: true,
              products: true,
              settings: true,
              users: true,
              analytics: true,
              bookings: true,
              'booking-settings': true
            });
          }
          const docRef = doc(this.firestore, 'admin_sections_permissions', email);
          return docData(docRef).pipe(
            map((data: any) => {
              if (!data || !data.sections) {
                return {
                  dashboard: true,
                  products: true,
                  settings: true,
                  users: true,
                  analytics: true,
                  bookings: true,
                  'booking-settings': true
                };
              }
              return data.sections;
            }),
            catchError(() => of({
              dashboard: true,
              products: true,
              settings: true,
              users: true,
              analytics: true,
              bookings: true,
              'booking-settings': true
            }))
          );
        })
      );
    })
  );

  constructor() {
    this.user$.subscribe(async (user) => {
      this.authInitialized.next(true);
      if (user && user.email) {
        try {
          const userRef = doc(this.firestore, 'users', user.uid);
          await setDoc(
            userRef,
            {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || '',
              photoURL: user.photoURL || '',
              lastLogin: serverTimestamp(),
              providerId: user.providerData[0]?.providerId || 'password',
            },
            { merge: true }
          );
        } catch (error) {
          console.error('Error synchronizing user data to Firestore:', error);
        }
      }
    });
  }

  async grantAdmin(email: string, performedBy: string): Promise<void> {
    const adminRef = doc(this.firestore, 'admins', email);
    await setDoc(adminRef, {
      email,
      grantedAt: serverTimestamp(),
      grantedBy: performedBy,
    });
    await this.logAccessChange(email, 'grant_admin', performedBy);
  }

  async removeAdmin(email: string, performedBy: string): Promise<void> {
    const adminRef = doc(this.firestore, 'admins', email);
    await deleteDoc(adminRef);
    await this.logAccessChange(email, 'remove_admin', performedBy);
  }

  async grantSuperAdmin(email: string, performedBy: string): Promise<void> {
    const ref = doc(this.firestore, 'super_admin', email);
    await setDoc(ref, {
      email,
      grantedAt: serverTimestamp(),
      grantedBy: performedBy,
    });
    await this.logAccessChange(email, 'grant_super_admin', performedBy);
  }

  async removeSuperAdmin(email: string, performedBy: string): Promise<void> {
    if (email === 'manirajmca.ac@gmail.com') return;
    const ref = doc(this.firestore, 'super_admin', email);
    await deleteDoc(ref);
    await this.logAccessChange(email, 'remove_super_admin', performedBy);
  }

  async restrictUser(email: string, performedBy: string): Promise<void> {
    const restrictedRef = doc(this.firestore, 'restricted_users', email);
    await setDoc(restrictedRef, {
      email,
      restrictedAt: serverTimestamp(),
      restrictedBy: performedBy,
    });

    const allowedRef = doc(this.firestore, 'allowed_users', email);
    await deleteDoc(allowedRef);

    await this.logAccessChange(email, 'restrict_access', performedBy);
  }

  async allowUser(email: string, performedBy: string): Promise<void> {
    const restrictedRef = doc(this.firestore, 'restricted_users', email);
    await deleteDoc(restrictedRef);

    const allowedRef = doc(this.firestore, 'allowed_users', email);
    await setDoc(allowedRef, {
      email,
      allowedAt: serverTimestamp(),
      allowedBy: performedBy,
    });

    await this.logAccessChange(email, 'allow_access', performedBy);
  }

  async updateAdminSectionPermission(email: string, sections: Record<string, boolean>, performedBy: string): Promise<void> {
    const docRef = doc(this.firestore, 'admin_sections_permissions', email);
    await setDoc(docRef, {
      email,
      sections,
      updatedAt: serverTimestamp(),
      updatedBy: performedBy
    }, { merge: true });
    await this.logAccessChange(email, `update_sections_visibility`, performedBy);
  }

  private async logAccessChange(email: string, action: string, performedBy: string): Promise<void> {
    const logRef = doc(collection(this.firestore, 'access_control'));
    await setDoc(logRef, {
      id: logRef.id,
      email,
      action,
      timestamp: serverTimestamp(),
      performedBy,
    });
  }

  readonly userSite$: Observable<SiteConfig | null> = this.user$.pipe(
    switchMap((user) => {
      if (!user?.uid) return of(null);
      const sitesRef = collection(this.firestore, 'sites');
      const q = query(sitesRef, where('ownerUid', '==', user.uid));
      return collectionData(q, { idField: 'id' }).pipe(
        map((docs) => (docs.length ? (docs[0] as SiteConfig) : null)),
        catchError(() => of(null))
      );
    })
  );

  readonly allSites$ = collectionData(collection(this.firestore, 'sites'), { idField: 'id' }) as Observable<SiteConfig[]>;

  readonly allMenus$ = this.activeOwnerUid$.pipe(
    switchMap((ownerUid) => {
      if (!ownerUid) {
        return collectionData(query(collection(this.firestore, 'menus'), orderBy('order')), { idField: 'id' }) as Observable<MenuItem[]>;
      }
      const q = query(collection(this.firestore, 'menus'), where('ownerUid', '==', ownerUid), orderBy('order'));
      return collectionData(q, { idField: 'id' }).pipe(
        switchMap((items) => {
          if (!items || items.length === 0) {
            return collectionData(query(collection(this.firestore, 'menus'), orderBy('order')), { idField: 'id' }) as Observable<MenuItem[]>;
          }
          return of(items as MenuItem[]);
        }),
        catchError(() => of(defaultMenus))
      );
    })
  );

  readonly menus$ = this.allMenus$.pipe(
    map((items) => items.filter((x) => x.isVisible !== false)),
    catchError(() => of(defaultMenus))
  );

  readonly allSections$ = this.activeOwnerUid$.pipe(
    switchMap((ownerUid) => {
      if (!ownerUid) {
        return collectionData(query(collection(this.firestore, 'sections'), orderBy('order')), { idField: 'id' }) as Observable<WebsiteSection[]>;
      }
      const q = query(collection(this.firestore, 'sections'), where('ownerUid', '==', ownerUid), orderBy('order'));
      return collectionData(q, { idField: 'id' }).pipe(
        switchMap((items) => {
          if (!items || items.length === 0) {
            return collectionData(query(collection(this.firestore, 'sections'), orderBy('order')), { idField: 'id' }) as Observable<WebsiteSection[]>;
          }
          return of(items as WebsiteSection[]);
        }),
        catchError(() => of(defaultSections))
      );
    })
  );

  readonly sections$ = this.allSections$.pipe(
    map((items) => {
      const visible = items.filter((x) => x.isVisible !== false);
      return visible.length ? visible : defaultSections;
    }),
    startWith(defaultSections),
    catchError(() => of(defaultSections))
  );

  readonly themeSettingsDocs$ = this.activeOwnerUid$.pipe(
    switchMap((ownerUid) => {
      if (!ownerUid) {
        return collectionData(collection(this.firestore, 'themeSettings'), { idField: 'id' }) as Observable<ThemeSettings[]>;
      }
      const q = query(collection(this.firestore, 'themeSettings'), where('ownerUid', '==', ownerUid));
      return collectionData(q, { idField: 'id' }).pipe(
        switchMap((docs) => {
          if (!docs || docs.length === 0) {
            return collectionData(collection(this.firestore, 'themeSettings'), { idField: 'id' }) as Observable<ThemeSettings[]>;
          }
          return of(docs as ThemeSettings[]);
        })
      );
    })
  );

  readonly themeSettings$ = this.themeSettingsDocs$.pipe(
    map((items) => items[0] ?? defaultThemeSettings),
    startWith(defaultThemeSettings),
    catchError(() => of(defaultThemeSettings))
  );

  readonly footerSettingsDocs$ = this.activeOwnerUid$.pipe(
    switchMap((ownerUid) => {
      if (!ownerUid) {
        return collectionData(collection(this.firestore, 'footerSettings'), { idField: 'id' }) as Observable<FooterSettings[]>;
      }
      const q = query(collection(this.firestore, 'footerSettings'), where('ownerUid', '==', ownerUid));
      return collectionData(q, { idField: 'id' }).pipe(
        switchMap((docs) => {
          if (!docs || docs.length === 0) {
            return collectionData(collection(this.firestore, 'footerSettings'), { idField: 'id' }) as Observable<FooterSettings[]>;
          }
          return of(docs as FooterSettings[]);
        })
      );
    })
  );

  readonly footerSettings$ = this.footerSettingsDocs$.pipe(
    map((items) => items[0] ?? defaultFooterSettings),
    startWith(defaultFooterSettings),
    catchError(() => of(defaultFooterSettings))
  );

  readonly headerSettingsDocs$ = this.activeOwnerUid$.pipe(
    switchMap((ownerUid) => {
      if (!ownerUid) {
        return collectionData(collection(this.firestore, 'headerSettings'), { idField: 'id' }) as Observable<HeaderSettings[]>;
      }
      const q = query(collection(this.firestore, 'headerSettings'), where('ownerUid', '==', ownerUid));
      return collectionData(q, { idField: 'id' }).pipe(
        switchMap((docs) => {
          if (!docs || docs.length === 0) {
            return collectionData(collection(this.firestore, 'headerSettings'), { idField: 'id' }) as Observable<HeaderSettings[]>;
          }
          return of(docs as HeaderSettings[]);
        })
      );
    })
  );

  readonly headerSettings$ = this.headerSettingsDocs$.pipe(
    map((items) => items[0] ?? defaultHeaderSettings),
    startWith(defaultHeaderSettings),
    catchError(() => of(defaultHeaderSettings))
  );

  signInWithGoogle(): Promise<unknown> {
    return signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  signInWithEmail(email: string, password: string): Promise<unknown> {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  registerWithEmail(email: string, password: string): Promise<unknown> {
    return createUserWithEmailAndPassword(this.auth, email, password);
  }

  sendPasswordReset(email: string): Promise<void> {
    return sendPasswordResetEmail(this.auth, email);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user || !user.email) {
      throw new Error('No authenticated user found.');
    }
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  }

  signOut(): Promise<void> {
    return signOut(this.auth);
  }

  async getUserSite(uid: string): Promise<SiteConfig | null> {
    if (!uid) return null;
    const sitesRef = collection(this.firestore, 'sites');
    const q = query(sitesRef, where('ownerUid', '==', uid));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as SiteConfig;
    }
    return null;
  }

  async registerTenantAndSite(params: {
    uid: string;
    email: string;
    displayName: string;
    phone: string;
    authProvider: 'google' | 'email';
    siteName: string;
    siteType: 'custom-domain' | 'subdomain';
    domain?: string | null;
    subdomain?: string | null;
  }): Promise<SiteConfig> {
    const userRef = doc(this.firestore, 'users', params.uid);
    const siteRef = doc(collection(this.firestore, 'sites'));
    const siteId = siteRef.id;

    const normalizedSubdomain = params.subdomain
      ? this.tenantResolver.normalizeSubdomain(params.subdomain)
      : null;
    const normalizedDomain = params.domain
      ? this.tenantResolver.normalizeDomain(params.domain)
      : null;

    const siteConfig: SiteConfig = {
      id: siteId,
      siteId,
      ownerUid: params.uid,
      siteName: params.siteName,
      siteType: params.siteType,
      domain: params.domain || null,
      subdomain: params.subdomain || null,
      normalizedDomain,
      normalizedSubdomain,
      status: 'active',
      domainStatus: params.siteType === 'custom-domain' ? 'PENDING' : 'ACTIVE',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const userProfile: UserProfile = {
      uid: params.uid,
      email: params.email,
      displayName: params.displayName,
      phone: params.phone,
      authProvider: params.authProvider,
      status: 'active',
      siteId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, userProfile, { merge: true });
    await setDoc(siteRef, siteConfig);

    // Grant admin access so permissions & dashboard work for user
    await this.grantAdmin(params.email, 'system_registration');

    // Seed default website configuration for this tenant UID
    await this.seedDefaultWebsiteForUser(params.uid, params.siteName);

    return siteConfig;
  }

  async seedDefaultWebsiteForUser(ownerUid: string, siteName: string): Promise<void> {
    const userMenus = defaultMenus.map((m) => ({
      ...m,
      id: `${ownerUid}_${m.id}`,
      ownerUid,
    }));

    const userSections = defaultSections.map((s) => ({
      ...s,
      id: `${ownerUid}_${s.id}`,
      ownerUid,
    }));

    const userTheme: ThemeSettings = {
      ...defaultThemeSettings,
      id: ownerUid,
      ownerUid,
    };

    const userFooter: FooterSettings = {
      ...defaultFooterSettings,
      id: ownerUid,
      ownerUid,
    };

    const userHeader: HeaderSettings = {
      ...defaultHeaderSettings,
      id: ownerUid,
      websiteName: siteName || defaultHeaderSettings.websiteName,
      ownerUid,
    };

    await Promise.all([
      ...userMenus.map((m) => setDoc(doc(this.firestore, 'menus', m.id), m, { merge: true })),
      ...userSections.map((s) => setDoc(doc(this.firestore, 'sections', s.id), s, { merge: true })),
      setDoc(doc(this.firestore, 'themeSettings', ownerUid), userTheme, { merge: true }),
      setDoc(doc(this.firestore, 'footerSettings', ownerUid), userFooter, { merge: true }),
      setDoc(doc(this.firestore, 'headerSettings', ownerUid), userHeader, { merge: true }),
    ]);
  }

  async updateSiteConfig(siteConfig: Partial<SiteConfig> & { id: string }): Promise<void> {
    const siteRef = doc(this.firestore, 'sites', siteConfig.id);
    const updates: any = {
      ...siteConfig,
      updatedAt: serverTimestamp(),
    };
    if (siteConfig.subdomain !== undefined) {
      updates.normalizedSubdomain = siteConfig.subdomain
        ? this.tenantResolver.normalizeSubdomain(siteConfig.subdomain)
        : null;
    }
    if (siteConfig.domain !== undefined) {
      updates.normalizedDomain = siteConfig.domain
        ? this.tenantResolver.normalizeDomain(siteConfig.domain)
        : null;
    }
    await setDoc(siteRef, updates, { merge: true });
  }

  upsertMenu(menu: MenuItem): Promise<void> {
    const ownerUid = menu.ownerUid || this.auth.currentUser?.uid || '';
    const id = menu.id || (ownerUid ? `${ownerUid}_${menu.sectionId || crypto.randomUUID()}` : crypto.randomUUID());
    return setDoc(doc(this.firestore, 'menus', id), { ...menu, id, ownerUid }, { merge: true });
  }

  deleteMenu(id: string): Promise<void> {
    return deleteDoc(doc(this.firestore, 'menus', id));
  }

  upsertSection(section: WebsiteSection): Promise<void> {
    const ownerUid = section.ownerUid || this.auth.currentUser?.uid || '';
    const id = section.id || (ownerUid ? `${ownerUid}_${section.sectionId || crypto.randomUUID()}` : crypto.randomUUID());
    return setDoc(
      doc(this.firestore, 'sections', id),
      {
        ...section,
        id,
        ownerUid,
        updatedDate: serverTimestamp(),
        createdDate: section.createdDate ?? serverTimestamp(),
      },
      { merge: true },
    );
  }

  deleteSection(id: string): Promise<void> {
    return deleteDoc(doc(this.firestore, 'sections', id));
  }

  saveThemeSettings(settings: ThemeSettings): Promise<void> {
    const ownerUid = settings.ownerUid || this.auth.currentUser?.uid || 'global';
    const id = settings.id && settings.id !== 'global' ? settings.id : ownerUid;
    return setDoc(
      doc(this.firestore, 'themeSettings', id),
      { ...settings, id, ownerUid },
      { merge: true },
    );
  }

  saveFooterSettings(settings: FooterSettings): Promise<void> {
    const ownerUid = settings.ownerUid || this.auth.currentUser?.uid || 'global';
    const id = settings.id && settings.id !== 'global' ? settings.id : ownerUid;
    return setDoc(
      doc(this.firestore, 'footerSettings', id),
      { ...settings, id, ownerUid },
      { merge: true },
    );
  }

  saveHeaderSettings(settings: HeaderSettings): Promise<void> {
    const ownerUid = settings.ownerUid || this.auth.currentUser?.uid || 'global';
    const id = settings.id && settings.id !== 'global' ? settings.id : ownerUid;
    return setDoc(
      doc(this.firestore, 'headerSettings', id),
      { ...settings, id, ownerUid },
      { merge: true },
    );
  }

  async uploadImage(file: File): Promise<string> {
    const storageRef = ref(this.storage, `website/${Date.now()}-${file.name}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }

  async seedDefaultWebsite(): Promise<void> {
    const user = this.auth.currentUser;
    if (user?.uid) {
      await this.seedDefaultWebsiteForUser(user.uid, 'DySi Site');
      return;
    }
    await this.removeNonDefaultDocuments(
      'menus',
      defaultMenus.map((menu) => menu.id ?? menu.sectionId),
    );
    await this.removeNonDefaultDocuments(
      'sections',
      defaultSections.map((section) => section.id ?? section.sectionId),
    );
    await Promise.all([
      ...defaultMenus.map((menu) => this.upsertMenu(menu)),
      ...defaultSections.map((section) => this.upsertSection(section)),
      this.saveThemeSettings(defaultThemeSettings),
      this.saveFooterSettings(defaultFooterSettings),
      this.saveHeaderSettings(defaultHeaderSettings),
    ]);
  }

  private async removeNonDefaultDocuments(
    collectionName: 'menus' | 'sections',
    allowedIds: string[],
  ): Promise<void> {
    const allowed = new Set(allowedIds);
    const snapshot = await getDocs(collection(this.firestore, collectionName));
    await Promise.all(
      snapshot.docs
        .filter((item) => !allowed.has(item.id))
        .map((item) => deleteDoc(doc(this.firestore, collectionName, item.id))),
    );
  }
}

export const defaultThemeSettings: ThemeSettings = {
  id: 'global',
  primaryColor: '#2563eb',
  secondaryColor: '#7c3aed',
  backgroundColor: '#f7f9ff',
  textColor: '#172033',
  buttonColor: '#2563eb',
  fontFamily: 'Inter',
  fontSize: '16px',
  fontWeight: '400',
  letterSpacing: '0px',
  lineHeight: '1.6',
  sectionSpacing: '6rem',
  borderRadius: '18px',
  cardShadow: '0 1rem 2.4rem rgba(30, 41, 59, 0.12)',
  containerWidth: '1120px',
  showTopNavMenu: true,
  showHeader: true,
  themeMode: 'light',
};

export const defaultFooterSettings: FooterSettings = {
  id: 'global',
  description:
    'Modern digital systems for teams that care about clarity, speed, and reliable growth.',
  importantLinks: [
    { label: 'Privacy Policy', url: '#' },
    { label: 'Terms of Service', url: '#' },
    { label: 'Careers', url: '#' },
  ],
  socialLinks: [
    { label: 'LinkedIn', url: '#', icon: 'fa-brands fa-linkedin-in' },
    { label: 'Instagram', url: '#', icon: 'fa-brands fa-instagram' },
    { label: 'X', url: '#', icon: 'fa-brands fa-x-twitter' },
  ],
  copyright: 'Copyright 2026 DySi. All rights reserved.',
};

export const defaultHeaderSettings: HeaderSettings = {
  id: 'global',
  logoUrl: '',
  websiteName: 'DySi',
  logoAlt: 'DySi Logo',
  logoWidth: '32px',
  logoHeight: '32px',
  headerWidth: 'fit-content',
  headerMenuOption: 'no-full-width',
};

export const defaultMenus: MenuItem[] = [
  { id: 'home', title: 'Home', routeKey: 'home', order: 1, isVisible: true, sectionId: 'home' },
  {
    id: 'about',
    title: 'About Us',
    routeKey: 'about',
    order: 2,
    isVisible: true,
    sectionId: 'about',
  },
  {
    id: 'services',
    title: 'Services',
    routeKey: 'services',
    order: 3,
    isVisible: true,
    sectionId: 'services',
  },
  { id: 'team', title: 'Team', routeKey: 'team', order: 4, isVisible: true, sectionId: 'team' },
  {
    id: 'feedback',
    title: 'Feedback',
    routeKey: 'feedback',
    order: 5,
    isVisible: true,
    sectionId: 'feedback',
  },
  {
    id: 'contact',
    title: 'Contact Us',
    routeKey: 'contact',
    order: 6,
    isVisible: true,
    sectionId: 'contact',
  },
  {
    id: 'footer',
    title: 'Footer',
    routeKey: 'footer',
    order: 7,
    isVisible: true,
    sectionId: 'footer',
  },
  { id: 'faq', title: 'FAQ', routeKey: 'faq', order: 8, isVisible: true, sectionId: 'faq' },
  {
    id: 'gallery',
    title: 'Gallery',
    routeKey: 'gallery',
    order: 9,
    isVisible: true,
    sectionId: 'gallery',
  },
];

export const defaultSections: WebsiteSection[] = [
  {
    id: 'home',
    sectionId: 'home',
    title: 'Build smarter customer experiences with DySi.###',
    subtitle: 'Digital systems that feel effortless',
    description:
      'We design scalable web platforms, automation workflows, and data-led digital products for ambitious businesses.',
    imageUrl:
      'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=80',
    buttonText: 'Book a Tour',
    buttonLink: '/bookings',
    backgroundColor: '#101a4a',
    textColor: '#ffffff',
    fontFamily: 'Inter',
    fontSize: '18px',
    layoutType: 'hero',
    isDarkSection: true,
    isVisible: true,
    order: 1,
    cards: [
      { icon: 'fa-solid fa-arrow-trend-up', title: '98%', description: 'client retention' },
      { icon: 'fa-solid fa-rocket', title: '42+', description: 'products launched' },
      { icon: 'fa-solid fa-headset', title: '24/7', description: 'delivery support' },
    ],
    slides: [
      {
        id: 'slide-1',
        imageUrl: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=80',
        title: 'Build smarter customer experiences with DySi.',
        subtitle: 'Digital systems that feel effortless',
        description: 'We design scalable web platforms, automation workflows, and data-led digital products for ambitious businesses.',
        buttonText: 'Book a Tour',
        buttonLink: '/bookings',
        textPosition: 'left'
      },
      {
        id: 'slide-2',
        imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1800&q=80',
        title: 'Next-Gen Digital Systems.',
        subtitle: 'Seamless and Responsive Integrations',
        description: 'Empower your teams with real-time operations, modern cloud solutions, and beautifully designed user experiences.',
        buttonText: 'Start a Project',
        buttonLink: '/bookings',
        textPosition: 'center'
      }
    ],
    faqs: [],
    gallery: [],
  },
  {
    id: 'about',
    sectionId: 'about',
    title: 'A product-minded technology team for growing companies.',
    subtitle: 'About Us',
    description:
      'DySi partners with founders, operators, and enterprise teams to plan, design, build, and improve digital systems.',
    imageUrl: '',
    buttonText: '',
    buttonLink: '',
    backgroundColor: '',
    textColor: '',
    fontFamily: 'Inter',
    fontSize: '16px',
    layoutType: 'about',
    isDarkSection: false,
    isVisible: true,
    order: 2,
    cards: [
      {
        icon: 'fa-solid fa-bullseye',
        title: 'Mission',
        description: 'Turn complex goals into reliable products.',
      },
      {
        icon: 'fa-solid fa-eye',
        title: 'Vision',
        description: 'Make modern software useful and beautifully simple.',
      },
      {
        icon: 'fa-solid fa-handshake',
        title: 'Values',
        description: 'Partnership, clarity, outcomes, and care.',
      },
    ],
    faqs: [],
    gallery: [],
  },
  {
    id: 'services',
    sectionId: 'services',
    title: 'Digital services shaped around outcomes.',
    subtitle: 'Services',
    description:
      'From strategy to launch and beyond, we create systems that teams can actually operate.',
    imageUrl: '',
    buttonText: 'View More Services',
    buttonLink: '/services',
    backgroundColor: '',
    textColor: '',
    fontFamily: 'Inter',
    fontSize: '16px',
    layoutType: 'services',
    isDarkSection: false,
    isVisible: true,
    order: 3,
    cards: [
      {
        icon: 'fa-solid fa-code',
        title: 'Web App Development',
        description: 'Responsive Angular and cloud apps.',
      },
      {
        icon: 'fa-solid fa-chart-line',
        title: 'Growth Analytics',
        description: 'Dashboards and product insights.',
      },
      {
        icon: 'fa-solid fa-shield-halved',
        title: 'Cloud Architecture',
        description: 'Secure deployment pipelines.',
      },
      {
        icon: 'fa-solid fa-robot',
        title: 'Automation',
        description: 'Workflow systems that reduce busywork.',
      },
    ],
    faqs: [],
    gallery: [],
  },
  {
    id: 'team',
    sectionId: 'team',
    title: 'Experienced people, calm delivery.',
    subtitle: 'Team',
    description:
      'Meet the operators, designers, and engineers who keep projects moving with care and clarity.',
    imageUrl: '',
    buttonText: '',
    buttonLink: '',
    backgroundColor: '',
    textColor: '',
    fontFamily: 'Inter',
    fontSize: '16px',
    layoutType: 'team',
    isDarkSection: false,
    isVisible: true,
    order: 4,
    cards: [
      {
        icon: 'fa-brands fa-linkedin-in',
        title: 'Aarav Mehta',
        description: 'Product Strategist',
        imageUrl:
          'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=80',
      },
      {
        icon: 'fa-brands fa-linkedin-in',
        title: 'Nisha Rao',
        description: 'UX Design Lead',
        imageUrl:
          'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=80',
      },
      {
        icon: 'fa-brands fa-linkedin-in',
        title: 'Kabir Sethi',
        description: 'Cloud Architect',
        imageUrl:
          'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=500&q=80',
      },
    ],
    faqs: [],
    gallery: [],
  },
  {
    id: 'feedback',
    sectionId: 'feedback',
    title: 'What clients say after launch.',
    subtitle: 'Feedback',
    description: 'Real outcomes from teams that trusted DySi with their digital platforms.',
    imageUrl: '',
    buttonText: 'Give Feedback',
    buttonLink: '/add-feedback',
    backgroundColor: '',
    textColor: '',
    fontFamily: 'Inter',
    fontSize: '16px',
    layoutType: 'testimonials',
    isDarkSection: false,
    isVisible: true,
    order: 5,
    cards: [
      {
        icon: 'fa-solid fa-star',
        title: 'Rhea Kapoor',
        description: 'DySi replaced a slow workflow with a polished portal our team enjoys using.',
        imageUrl:
          'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=300&q=80',
        meta: 'BrightOps',
        rating: 5,
      },
      {
        icon: 'fa-solid fa-star',
        title: 'Daniel Brooks',
        description: 'They translated product strategy into engineering with real precision.',
        imageUrl:
          'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80',
        meta: 'Northstar Labs',
        rating: 5,
      },
    ],
    faqs: [],
    gallery: [],
  },
  {
    id: 'contact',
    sectionId: 'contact',
    title: 'Tell us what you want to build next.',
    subtitle: 'Contact Us',
    description: 'Share a few details and we will help shape the right first step.',
    imageUrl: '',
    buttonText: 'Send Message',
    buttonLink: '',
    backgroundColor: '',
    textColor: '',
    fontFamily: 'Inter',
    fontSize: '16px',
    layoutType: 'contact',
    isDarkSection: false,
    isVisible: true,
    order: 6,
    cards: [
      { icon: 'fa-solid fa-envelope', title: 'Email', description: 'hello@dysi.example' },
      { icon: 'fa-solid fa-phone', title: 'Phone', description: '+91 98765 43210' },
      { icon: 'fa-solid fa-location-dot', title: 'Office', description: 'Bengaluru, India' },
    ],
    faqs: [],
    gallery: [],
  },
  {
    id: 'faq',
    sectionId: 'faq',
    title: 'Frequently asked questions.',
    subtitle: 'FAQ',
    description: 'Clear answers before we begin.',
    imageUrl: '',
    buttonText: '',
    buttonLink: '',
    backgroundColor: '',
    textColor: '',
    fontFamily: 'Inter',
    fontSize: '16px',
    layoutType: 'faq',
    isDarkSection: false,
    isVisible: true,
    order: 7,
    cards: [],
    faqs: [
      {
        question: 'Can content be managed without code?',
        answer:
          'Yes. Menus, sections, cards, theme, and footer settings are editable from the admin panel.',
      },
      {
        question: 'Does the site update in real time?',
        answer: 'Yes. Firestore streams push content updates to the website automatically.',
      },
    ],
    gallery: [],
  },
  {
    id: 'gallery',
    sectionId: 'gallery',
    title: 'Recent digital moments.',
    subtitle: 'Gallery',
    description: 'A flexible image grid for launches, events, offices, and product highlights.',
    imageUrl: '',
    buttonText: '',
    buttonLink: '',
    backgroundColor: '',
    textColor: '',
    fontFamily: 'Inter',
    fontSize: '16px',
    layoutType: 'gallery',
    isDarkSection: false,
    isVisible: true,
    order: 8,
    cards: [],
    faqs: [],
    gallery: [
      'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=700&q=80',
      'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=700&q=80',
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=700&q=80',
    ],
  },
];
