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
} from '@angular/fire/auth';
import {
  Firestore,
  collection,
  collectionData,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from '@angular/fire/firestore';
import { Storage, getDownloadURL, ref, uploadBytes } from '@angular/fire/storage';
import { Observable, catchError, map, of, startWith, tap } from 'rxjs';

import { FooterSettings, MenuItem, ThemeSettings, WebsiteSection } from '../models/website.models';

@Injectable({ providedIn: 'root' })
export class WebsiteDataService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly storage = inject(Storage);

  readonly user$: Observable<User | null> = authState(this.auth);

  readonly menus$ = collectionData(query(collection(this.firestore, 'menus'), orderBy('order')), {
    idField: 'id',
  }).pipe(
    tap({
      next: (data) => {
        console.log('Firestore success:', data);
      },
      error: (err) => {
        console.error('Firestore stream error:', err);
      },
    }),
    map((items) => {
      console.log('Map executing');
      return (items as MenuItem[]).filter((x) => x.isVisible !== false);
    }),

    catchError((error) => {
      console.error('CatchError executing:', error);
      return of(defaultMenus);
    }),
  );

  readonly allMenus$ = collectionData(
    query(collection(this.firestore, 'menus'), orderBy('order')),
    {
      idField: 'id',
    },
  ) as Observable<MenuItem[]>;

  readonly sections$ = collectionData(
    query(collection(this.firestore, 'sections'), orderBy('order')),
    {
      idField: 'id',
    },
  ).pipe(
    map((items) => {
      const sections = (items as WebsiteSection[]).filter((item) => item.isVisible !== false);
      return sections.length ? sections : defaultSections;
    }),
    startWith(defaultSections),
    catchError((error) => {
      console.error('Failed to load sections from Firestore.', error);
      return of(defaultSections);
    }),
  );

  readonly allSections$ = collectionData(
    query(collection(this.firestore, 'sections'), orderBy('order')),
    {
      idField: 'id',
    },
  ) as Observable<WebsiteSection[]>;

  readonly themeSettings$ = collectionData(collection(this.firestore, 'themeSettings'), {
    idField: 'id',
  }).pipe(
    map((items) => (items as ThemeSettings[])[0] ?? defaultThemeSettings),
    startWith(defaultThemeSettings),
    catchError((error) => {
      console.error('Failed to load theme settings from Firestore.', error);
      return of(defaultThemeSettings);
    }),
  );

  readonly footerSettings$ = collectionData(collection(this.firestore, 'footerSettings'), {
    idField: 'id',
  }).pipe(
    map((items) => (items as FooterSettings[])[0] ?? defaultFooterSettings),
    startWith(defaultFooterSettings),
    catchError((error) => {
      console.error('Failed to load footer settings from Firestore.', error);
      return of(defaultFooterSettings);
    }),
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

  signOut(): Promise<void> {
    return signOut(this.auth);
  }

  upsertMenu(menu: MenuItem): Promise<void> {
    const id = menu.id || menu.sectionId || crypto.randomUUID();
    return setDoc(doc(this.firestore, 'menus', id), { ...menu, id }, { merge: true });
  }

  deleteMenu(id: string): Promise<void> {
    return deleteDoc(doc(this.firestore, 'menus', id));
  }

  upsertSection(section: WebsiteSection): Promise<void> {
    const id = section.id || section.sectionId || crypto.randomUUID();
    return setDoc(
      doc(this.firestore, 'sections', id),
      {
        ...section,
        id,
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
    return setDoc(
      doc(this.firestore, 'themeSettings', 'global'),
      { ...settings, id: 'global' },
      { merge: true },
    );
  }

  saveFooterSettings(settings: FooterSettings): Promise<void> {
    return setDoc(
      doc(this.firestore, 'footerSettings', 'global'),
      { ...settings, id: 'global' },
      { merge: true },
    );
  }

  async uploadImage(file: File): Promise<string> {
    const storageRef = ref(this.storage, `website/${Date.now()}-${file.name}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }

  async seedDefaultWebsite(): Promise<void> {
    debugger;
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
  themeMode: 'auto',
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
    buttonText: 'Start a Project',
    buttonLink: 'contact',
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
    buttonText: '',
    buttonLink: '',
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
