import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  Firestore,
  collection,
  collectionData,
  deleteDoc,
  doc,
  docData,
  query,
  serverTimestamp,
  setDoc,
  where,
} from '@angular/fire/firestore';
import { Subscription } from 'rxjs';

import { WebsiteDataService } from '../../core/services/website-data.service';

export interface SupportChatMessage {
  id: string;
  sender: 'user' | 'ai' | 'team';
  senderName: string;
  text: string;
  time: string;
}

export interface SupportConversation {
  id: string;
  uid: string;
  title: string;
  status: 'open' | 'escalated' | 'resolved';
  icon: string;
  messages: SupportChatMessage[];
  updatedAt?: any;
}

export interface TemplateCatalogItem {
  id: string;
  name: string;
  themeId: string;
  category: string;
  style: 'Modern' | 'Minimal' | 'Bold' | 'Professional' | 'Creative';
  layout: 'Landing Page' | 'Multi-Page' | 'Storefront' | 'Booking';
  headline: string;
  subline: string;
  ctaLabel: string;
  ctaColor: string;
  imageUrl: string;
  tags: string[];
  popular?: boolean;
  description: string;
  accent: string;
  icon: string;
}

export interface ProjectReleaseItem {
  version: string;
  date: string;
  title: string;
  changes: string[];
  isCurrent?: boolean;
}

export type ProjectStatusType = 'Not Started' | 'In Progress' | 'Completed' | 'Upgrading';

export interface UserProjectItem {
  id: string;
  uid: string;
  name: string;
  domain: string;
  description: string;
  thumbnailUrl?: string;
  status: ProjectStatusType;
  startedDate: string;
  expectedCompletion: string;
  lastReleaseDate: string;
  latestFeature: string;
  releases: ProjectReleaseItem[];
  features: Array<{ label: string; done: boolean }>;
  notes: string;
  updatedAt?: any;
}

export interface ProjectRequirementItem {
  id: string;
  uid: string;
  title: string;
  businessType: string;
  primaryDomain: string;
  alternativeDomains: string[];
  projectDescription: string;
  expectedCompletionDate?: string;
  projectBudget?: string;
  selectedTemplate?: string;
  status: 'draft' | 'submitted' | 'approved';
  createdAt?: any;
  updatedAt?: any;
}

export interface UserProfileRequirement {
  uid?: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  contactAddress: string;
  photoURL?: string;
  expectedCompletionDate: string;
  projectBudget: string;
  businessType: string;
  primaryDomain: string;
  alternativeDomains: string[];
  projectDescription: string;
  selectedTemplate: string;
  status: 'draft' | 'submitted';
  updatedAt?: unknown;
}

@Component({
  selector: 'app-my-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './my-profile.html',
  styleUrls: ['./my-profile.scss'],
})
export class MyProfileComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly firestore = inject(Firestore);
  private readonly websiteData = inject(WebsiteDataService);
  private readonly router = inject(Router);

  readonly user$ = this.websiteData.user$;
  readonly currentStep = signal<1 | 2 | 3 | 4>(1);
  readonly activeSidebarItem = signal<'profile' | 'requirements' | 'projects' | 'templates' | 'support'>('profile');
  readonly isPreviewMode = signal(false);
  readonly isTopMenuOpen = signal(false);
  readonly isSaving = signal(false);
  readonly statusMessage = signal('');
  readonly statusType = signal<'success' | 'error' | 'info'>('info');
  readonly customPhotoUrl = signal('');
  readonly currentUid = signal<string | null>(null);
  readonly signInProvider = signal<'google' | 'email'>('email');
  readonly submissionStatus = signal<'draft' | 'submitted'>('draft');

  // My Requirements Timeline state
  readonly requirements = signal<ProjectRequirementItem[]>([]);
  readonly reqSearchQuery = signal('');
  readonly reqStatusFilter = signal<'all' | 'draft' | 'submitted' | 'approved'>('all');
  readonly reqDateFilter = signal('');
  readonly selectedRequirementId = signal<string | null>(null);

  readonly reqEditorTitle = signal('');
  readonly reqEditorBusinessType = signal('E-commerce / Online Store');
  readonly reqEditorPrimaryDomain = signal('');
  readonly reqEditorAltDomains = signal('');
  readonly reqEditorDescription = signal('');

  readonly filteredRequirements = computed(() => {
    const q = this.reqSearchQuery().toLowerCase().trim();
    const status = this.reqStatusFilter();
    const dateFilter = this.reqDateFilter();

    return [...this.requirements()]
      .filter((item) => {
        if (status !== 'all' && item.status !== status) return false;
        if (q) {
          const hay = [
            item.title,
            item.businessType,
            item.primaryDomain,
            item.projectDescription,
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (dateFilter) {
          const d = this.toDate(item.updatedAt || item.createdAt);
          const iso = d.toISOString().slice(0, 10);
          if (iso !== dateFilter) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          this.toDate(b.updatedAt || b.createdAt).getTime() -
          this.toDate(a.updatedAt || a.createdAt).getTime(),
      );
  });

  readonly groupedRequirements = computed(() => {
    const groups = new Map<string, ProjectRequirementItem[]>();
    for (const item of this.filteredRequirements()) {
      const d = this.toDate(item.updatedAt || item.createdAt);
      const label = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      if (!groups.has(label)) {
        groups.set(label, []);
      }
      groups.get(label)!.push(item);
    }
    return Array.from(groups.entries()).map(([dateLabel, items]) => ({
      dateLabel,
      items,
    }));
  });

  readonly selectedRequirement = computed(() => {
    const id = this.selectedRequirementId();
    const list = this.requirements();
    if (!list.length) return null;
    return list.find((r) => r.id === id) || list[0];
  });

  // ---- MY PROJECTS STATE ----
  readonly projects = signal<UserProjectItem[]>([]);
  readonly projectStatusFilter = signal<'All' | ProjectStatusType>('All');
  readonly projectSearchQuery = signal('');
  readonly projectViewMode = signal<'grid' | 'list'>('grid');
  readonly selectedProjectId = signal<string | null>(null);
  readonly projectDetailTab = signal<'releases' | 'details' | 'features' | 'notes'>('releases');
  readonly showNewProjectForm = signal(false);
  readonly showAddReleaseForm = signal(false);

  readonly newProjectForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    domain: [''],
    description: [''],
    thumbnailUrl: [''],
    status: ['Not Started' as ProjectStatusType],
    expectedCompletion: [''],
  });

  readonly newReleaseForm = this.fb.nonNullable.group({
    version: ['v1.0.0', Validators.required],
    title: ['', Validators.required],
    changesText: [''],
  });

  readonly newFeatureText = signal('');
  readonly projectNotesDraft = signal('');
  readonly editProjStatus = signal<ProjectStatusType>('In Progress');
  readonly editProjDomain = signal('');
  readonly editProjExpectedDate = signal('');
  readonly editProjDescription = signal('');

  readonly projectCounts = computed(() => {
    const list = this.projects();
    return {
      all: list.length,
      notStarted: list.filter((p) => p.status === 'Not Started').length,
      inProgress: list.filter((p) => p.status === 'In Progress').length,
      completed: list.filter((p) => p.status === 'Completed').length,
      upgrading: list.filter((p) => p.status === 'Upgrading').length,
    };
  });

  readonly filteredProjects = computed(() => {
    const status = this.projectStatusFilter();
    const q = this.projectSearchQuery().toLowerCase().trim();
    return this.projects().filter((p) => {
      if (status !== 'All' && p.status !== status) return false;
      if (q) {
        const hay = [p.name, p.domain, p.description, p.latestFeature].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });

  readonly selectedProject = computed(() => {
    const id = this.selectedProjectId();
    const list = this.projects();
    if (!list.length) return null;
    return list.find((p) => p.id === id) || list[0];
  });

  readonly businessTypes = [
    'E-commerce / Online Store',
    'Travel & Tour Bookings',
    'Corporate / Business Website',
    'Portfolio / Personal Brand',
    'Restaurant / Hospitality',
    'Healthcare / Clinic',
    'Education / Institute',
    'Real Estate / Property',
    'Other',
  ];

  readonly businessThemeCategories = [
    { id: 'all', label: 'All Templates', icon: 'fa-table-cells-large', subtitle: 'Explore ready-made modern website templates across every business category.', bannerImg: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=900&q=80' },
    { id: 'gym', label: 'Gym & Fitness', icon: 'fa-dumbbell', subtitle: 'Modern and responsive website templates for gyms, fitness centers, trainers and wellness studios.', bannerImg: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80' },
    { id: 'grocery', label: 'Grocery Shop', icon: 'fa-cart-shopping', subtitle: 'Fresh produce storefronts with quick cart, categories and local delivery slots.', bannerImg: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80' },
    { id: 'textile', label: 'Textile Shop', icon: 'fa-shirt', subtitle: 'Boutique fashion and textile catalogs with lookbooks and collections.', bannerImg: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80' },
    { id: 'restaurant', label: 'Restaurant / Food', icon: 'fa-utensils', subtitle: 'Appetizing restaurant templates with digital menus and table booking.', bannerImg: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80' },
    { id: 'ecommerce', label: 'E-commerce Store', icon: 'fa-bag-shopping', subtitle: 'Conversion-focused online store templates with product grids and checkout.', bannerImg: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80' },
    { id: 'salon', label: 'Salon & Spa', icon: 'fa-spa', subtitle: 'Elegant beauty salon and wellness booking experiences.', bannerImg: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=900&q=80' },
    { id: 'hospital', label: 'Hospital & Clinic', icon: 'fa-kit-medical', subtitle: 'Trustworthy healthcare portals with doctor directories and appointments.', bannerImg: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=900&q=80' },
    { id: 'education', label: 'Education / Coaching', icon: 'fa-graduation-cap', subtitle: 'Course catalogs, faculty profiles and student enrollment portals.', bannerImg: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=900&q=80' },
    { id: 'realestate', label: 'Real Estate', icon: 'fa-house-chimney', subtitle: 'Property showcase sites with interactive listings and site visits.', bannerImg: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=900&q=80' },
    { id: 'travel', label: 'Travel & Tour', icon: 'fa-plane', subtitle: 'Destination showcases, tour packages and bus/ticket booking.', bannerImg: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=900&q=80' },
    { id: 'others', label: 'Others', icon: 'fa-ellipsis', subtitle: 'Flexible multi-purpose templates for agencies, portfolios and startups.', bannerImg: 'https://images.unsplash.com/photo-1497215842964-222b430dc094?auto=format&fit=crop&w=900&q=80' },
  ];

  readonly templates: TemplateCatalogItem[] = [
    {
      id: 'gym-pro',
      name: 'Gym Pro',
      themeId: 'gym',
      category: 'Gym & Fitness',
      style: 'Modern',
      layout: 'Landing Page',
      headline: 'Transform Your Body & Life',
      subline: 'Professional training, modern equipment & expert trainers.',
      ctaLabel: 'Join Now',
      ctaColor: '#facc15',
      imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=700&q=80',
      tags: ['Modern', 'Fitness', 'Membership'],
      popular: true,
      description: 'High-energy dark gym template with membership plans, trainer cards, and class schedules.',
      accent: 'linear-gradient(135deg, #6d28d9, #9333ea)',
      icon: 'fa-dumbbell',
    },
    {
      id: 'elite-gym',
      name: 'Elite Gym',
      themeId: 'gym',
      category: 'Gym & Fitness',
      style: 'Bold',
      layout: 'Multi-Page',
      headline: 'Be Stronger Every Day',
      subline: 'Gym · Cardio · CrossFit · Yoga programs.',
      ctaLabel: 'Get Started',
      ctaColor: '#ef4444',
      imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=700&q=80',
      tags: ['Bold', 'Training', 'Classes'],
      popular: true,
      description: 'Bold athletic layout featuring transformation stories, class timetables, and trial booking.',
      accent: 'linear-gradient(135deg, #dc2626, #7c3aed)',
      icon: 'fa-dumbbell',
    },
    {
      id: 'flex-fit',
      name: 'FlexFit',
      themeId: 'gym',
      category: 'Gym & Fitness',
      style: 'Minimal',
      layout: 'Landing Page',
      headline: 'Fitness for a Healthier You',
      subline: 'Workout · Nutrition · Lifestyle coaching.',
      ctaLabel: 'Start Trial',
      ctaColor: '#84cc16',
      imageUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=700&q=80',
      tags: ['Minimal', 'Wellness', 'Responsive'],
      description: 'Sleek minimalist coaching template for personal trainers and nutrition studios.',
      accent: 'linear-gradient(135deg, #16a34a, #2563eb)',
      icon: 'fa-heart-pulse',
    },
    {
      id: 'powerhouse-gym',
      name: 'PowerHouse Gym',
      themeId: 'gym',
      category: 'Gym & Fitness',
      style: 'Professional',
      layout: 'Multi-Page',
      headline: 'Build Muscle. Gain Confidence.',
      subline: 'State-of-the-art gym with expert guidance.',
      ctaLabel: 'Join Now',
      ctaColor: '#ef4444',
      imageUrl: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=700&q=80',
      tags: ['Professional', 'Modern', 'Membership'],
      description: 'Strength-training focused layout with equipment gallery and membership tiers.',
      accent: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
      icon: 'fa-dumbbell',
    },
    {
      id: 'zen-fit',
      name: 'ZenFit',
      themeId: 'gym',
      category: 'Gym & Fitness',
      style: 'Minimal',
      layout: 'Booking',
      headline: 'Fitness & Wellness',
      subline: 'Yoga · Meditation · Mindful living.',
      ctaLabel: 'Explore Programs',
      ctaColor: '#22c55e',
      imageUrl: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=700&q=80',
      tags: ['Yoga', 'Wellness', 'Calm'],
      description: 'Serene yoga and meditation studio template with class booking and instructor bios.',
      accent: 'linear-gradient(135deg, #059669, #06b6d4)',
      icon: 'fa-spa',
    },
    {
      id: 'crossfit-x',
      name: 'CrossFit X',
      themeId: 'gym',
      category: 'Gym & Fitness',
      style: 'Bold',
      layout: 'Landing Page',
      headline: 'CROSSFIT TRAINING',
      subline: 'Strength · Endurance · Community.',
      ctaLabel: 'Get Started',
      ctaColor: '#f97316',
      imageUrl: 'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=700&q=80',
      tags: ['CrossFit', 'Sports', 'Dynamic'],
      description: 'Dynamic athletic template built for CrossFit boxes, bootcamps, and sports clubs.',
      accent: 'linear-gradient(135deg, #ea580c, #7c3aed)',
      icon: 'fa-fire',
    },
    {
      id: 'modern-commerce',
      name: 'Modern E-Commerce Pro',
      themeId: 'ecommerce',
      category: 'E-commerce Store',
      style: 'Modern',
      layout: 'Storefront',
      headline: 'Shop Smarter, Live Better',
      subline: 'Curated electronics, gadgets & fast delivery.',
      ctaLabel: 'Shop Now',
      ctaColor: '#8b5cf6',
      imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=700&q=80',
      tags: ['Storefront', 'Cart', 'Modern'],
      popular: true,
      description: 'Conversion-focused online store with product showcase, cart, and order tracking.',
      accent: 'linear-gradient(135deg, #6d28d9, #9333ea)',
      icon: 'fa-bag-shopping',
    },
    {
      id: 'travel-explorer',
      name: 'Travel & Tour Explorer',
      themeId: 'travel',
      category: 'Travel & Tour',
      style: 'Creative',
      layout: 'Booking',
      headline: 'Explore Dream Destinations',
      subline: 'Tour packages, bus bookings & family holidays.',
      ctaLabel: 'Book Tours',
      ctaColor: '#3b82f6',
      imageUrl: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=700&q=80',
      tags: ['Travel', 'Booking', 'Packages'],
      popular: true,
      description: 'Hero destination carousel, bus/tour seat booking, and package comparisons.',
      accent: 'linear-gradient(135deg, #2563eb, #7c3aed)',
      icon: 'fa-plane-departure',
    },
    {
      id: 'fresh-mart',
      name: 'FreshMart Grocery',
      themeId: 'grocery',
      category: 'Grocery Shop',
      style: 'Modern',
      layout: 'Storefront',
      headline: 'Fresh Groceries Delivered Daily',
      subline: 'Organic farm produce, dairy & daily essentials.',
      ctaLabel: 'Order Now',
      ctaColor: '#22c55e',
      imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=700&q=80',
      tags: ['Grocery', 'Delivery', 'Organic'],
      description: 'Clean neighborhood grocery storefront with quick-add items and delivery slots.',
      accent: 'linear-gradient(135deg, #16a34a, #10b981)',
      icon: 'fa-cart-shopping',
    },
    {
      id: 'silk-loom',
      name: 'Silk & Loom Boutique',
      themeId: 'textile',
      category: 'Textile Shop',
      style: 'Creative',
      layout: 'Storefront',
      headline: 'Timeless Fabrics & Fashion',
      subline: 'Handcrafted silk, ethnic wear & seasonal collections.',
      ctaLabel: 'View Collection',
      ctaColor: '#ec4899',
      imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=700&q=80',
      tags: ['Fashion', 'Lookbook', 'Boutique'],
      description: 'Editorial textile & fashion catalog showcasing fabrics, sarees, and custom tailoring.',
      accent: 'linear-gradient(135deg, #db2777, #7c3aed)',
      icon: 'fa-shirt',
    },
    {
      id: 'bistro-delight',
      name: 'Bistro Delight',
      themeId: 'restaurant',
      category: 'Restaurant / Food',
      style: 'Modern',
      layout: 'Booking',
      headline: 'Fine Dining & Craft Flavors',
      subline: 'Reserve your table or order signature dishes online.',
      ctaLabel: 'Book a Table',
      ctaColor: '#f59e0b',
      imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=700&q=80',
      tags: ['Menu', 'Table Booking', 'Food'],
      popular: true,
      description: 'Warm restaurant template with interactive menu categories and table reservations.',
      accent: 'linear-gradient(135deg, #d97706, #ef4444)',
      icon: 'fa-utensils',
    },
    {
      id: 'glow-salon',
      name: 'Glow Salon & Spa',
      themeId: 'salon',
      category: 'Salon & Spa',
      style: 'Minimal',
      layout: 'Booking',
      headline: 'Relax, Refresh & Radiate',
      subline: 'Hair styling, skin care & luxury spa therapies.',
      ctaLabel: 'Book Appointment',
      ctaColor: '#a855f7',
      imageUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=700&q=80',
      tags: ['Salon', 'Spa', 'Appointments'],
      description: 'Soft luxury salon layout with service menus, stylist gallery, and appointment booking.',
      accent: 'linear-gradient(135deg, #9333ea, #ec4899)',
      icon: 'fa-spa',
    },
    {
      id: 'care-plus',
      name: 'CarePlus Medical',
      themeId: 'hospital',
      category: 'Hospital & Clinic',
      style: 'Professional',
      layout: 'Multi-Page',
      headline: 'Trusted Care For Your Family',
      subline: 'Multi-specialty doctors, diagnostics & 24/7 support.',
      ctaLabel: 'Book Consultation',
      ctaColor: '#0ea5e9',
      imageUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=700&q=80',
      tags: ['Clinic', 'Doctors', 'Appointments'],
      description: 'Clean hospital & clinic portal with specialist directory and patient appointment booking.',
      accent: 'linear-gradient(135deg, #0284c7, #4f46e5)',
      icon: 'fa-kit-medical',
    },
    {
      id: 'edu-spark',
      name: 'EduSpark Academy',
      themeId: 'education',
      category: 'Education / Coaching',
      style: 'Professional',
      layout: 'Multi-Page',
      headline: 'Learn Skills That Matter',
      subline: 'Live classes, coaching batches & certifications.',
      ctaLabel: 'Explore Courses',
      ctaColor: '#6366f1',
      imageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=700&q=80',
      tags: ['Courses', 'Coaching', 'Admissions'],
      description: 'Education & coaching website with course syllabi, results showcase, and enquiry forms.',
      accent: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
      icon: 'fa-graduation-cap',
    },
    {
      id: 'prime-estates',
      name: 'Prime Estates',
      themeId: 'realestate',
      category: 'Real Estate',
      style: 'Professional',
      layout: 'Multi-Page',
      headline: 'Find Your Dream Property',
      subline: 'Verified villas, apartments & commercial spaces.',
      ctaLabel: 'View Listings',
      ctaColor: '#10b981',
      imageUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=700&q=80',
      tags: ['Properties', 'Listings', 'Real Estate'],
      description: 'Real estate portal with property search filters, floor plans, and site visit scheduling.',
      accent: 'linear-gradient(135deg, #059669, #4f46e5)',
      icon: 'fa-house-chimney',
    },
    {
      id: 'corporate-saas',
      name: 'Corporate SaaS Suite',
      themeId: 'others',
      category: 'Others',
      style: 'Modern',
      layout: 'Landing Page',
      headline: 'Scale Your Business Faster',
      subline: 'Modern agency & SaaS platform showcase.',
      ctaLabel: 'Get Started',
      ctaColor: '#7c3aed',
      imageUrl: 'https://images.unsplash.com/photo-1497215842964-222b430dc094?auto=format&fit=crop&w=700&q=80',
      tags: ['Agency', 'SaaS', 'Portfolio'],
      description: 'Clean executive landing page with services, testimonials, FAQ, and enquiry form.',
      accent: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
      icon: 'fa-building',
    },
  ];

  // ---- TEMPLATES MARKETPLACE STATE ----
  readonly activeThemeCategory = signal<string>('gym');
  readonly tplSearchQuery = signal('');
  readonly tplStyleFilter = signal('All');
  readonly tplLayoutFilter = signal('All');
  readonly tplSortBy = signal<'popular' | 'newest' | 'name'>('popular');
  readonly favoriteTemplateIds = signal<string[]>(['gym-pro']);
  readonly previewingTemplate = signal<TemplateCatalogItem | null>(null);

  readonly activeThemeMeta = computed(() => {
    const id = this.activeThemeCategory();
    return this.businessThemeCategories.find((c) => c.id === id) || this.businessThemeCategories[0];
  });

  readonly filteredTemplates = computed(() => {
    const cat = this.activeThemeCategory();
    const q = this.tplSearchQuery().toLowerCase().trim();
    const style = this.tplStyleFilter();
    const layout = this.tplLayoutFilter();
    const sort = this.tplSortBy();

    const list = this.templates.filter((t) => {
      if (cat !== 'all' && t.themeId !== cat) return false;
      if (style !== 'All' && t.style !== style) return false;
      if (layout !== 'All' && t.layout !== layout) return false;
      if (q) {
        const hay = [t.name, t.category, t.headline, t.description, ...t.tags].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sort === 'name') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sort === 'newest') {
      return [...list].reverse();
    }
    return [...list].sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0));
  });

  // ---- SUPPORT CENTER STATE ----
  readonly supportTab = signal<'chat' | 'tickets' | 'articles' | 'contact'>('chat');
  readonly supportConversations = signal<SupportConversation[]>([]);
  readonly selectedConversationId = signal<string | null>(null);
  readonly supportSearchQuery = signal('');
  readonly supportMessageInput = signal('');
  readonly contactSubject = signal('');
  readonly contactMessage = signal('');

  readonly helpArticles = [
    {
      title: 'How to Connect a Custom Domain',
      category: 'Domains & DNS',
      summary: 'Point your GoDaddy, Namecheap, or Cloudflare domain to your Dysi website with CNAME and A records.',
      icon: 'fa-globe',
    },
    {
      title: 'Setting Up Bus & Tour Booking Forms',
      category: 'Bookings',
      summary: 'Configure seat layouts (2+2 or 3+2), custom passenger fields, and dropdown options in Booking Settings.',
      icon: 'fa-bus',
    },
    {
      title: 'Managing Sections, Menus & Themes',
      category: 'Website Editor',
      summary: 'Drag-and-drop reorder sections, upload hero carousel slides, and customize your brand colors.',
      icon: 'fa-layer-group',
    },
    {
      title: 'Exporting & Importing Settings via Excel',
      category: 'Data Transfer',
      summary: 'Back up or bulk-edit menus, sections, theme, header, and footer settings with one Excel file.',
      icon: 'fa-file-excel',
    },
  ];

  readonly filteredConversations = computed(() => {
    const q = this.supportSearchQuery().toLowerCase().trim();
    const list = [...this.supportConversations()].sort(
      (a, b) => this.toDate(b.updatedAt).getTime() - this.toDate(a.updatedAt).getTime(),
    );
    if (!q) return list;
    return list.filter((c) => {
      const lastText = c.messages?.[c.messages.length - 1]?.text || '';
      return c.title.toLowerCase().includes(q) || lastText.toLowerCase().includes(q);
    });
  });

  readonly selectedConversation = computed(() => {
    const id = this.selectedConversationId();
    const list = this.supportConversations();
    if (!list.length) return null;
    return list.find((c) => c.id === id) || list[0];
  });

  readonly profileForm = this.fb.nonNullable.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phoneNumber: [''],
    contactAddress: [''],
    expectedCompletionDate: [''],
    projectBudget: [''],
    businessType: ['E-commerce / Online Store', Validators.required],
    primaryDomain: [''],
    alternativeDomains: this.fb.array<string>([]),
    projectDescription: [''],
    selectedTemplate: ['modern-commerce'],
  });

  private readonly subscriptions = new Subscription();

  get alternativeDomains(): FormArray {
    return this.profileForm.get('alternativeDomains') as FormArray;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isTopMenuOpen.set(false);
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.user$.subscribe((user) => {
        if (!user) {
          this.currentUid.set(null);
          return;
        }
        this.currentUid.set(user.uid);
        const isGoogle = user.providerData?.some((p) => p.providerId === 'google.com');
        this.signInProvider.set(isGoogle ? 'google' : 'email');

        // Pre-fill auth details immediately
        this.profileForm.patchValue({
          fullName: this.profileForm.controls.fullName.value || user.displayName || '',
          email: user.email || '',
        });
        if (!this.customPhotoUrl() && user.photoURL) {
          this.customPhotoUrl.set(user.photoURL);
        }

        // Load user's support conversations from Firestore
        const supQuery = query(
          collection(this.firestore, 'support_chats'),
          where('uid', '==', user.uid),
        );
        this.subscriptions.add(
          (collectionData(supQuery, { idField: 'id' }) as any).subscribe({
            next: (items: SupportConversation[]) => {
              this.supportConversations.set(items || []);
              if (items?.length && !this.selectedConversationId()) {
                this.selectedConversationId.set(items[0].id);
              }
            },
            error: (err: unknown) => {
              console.error('Failed to load support conversations:', err);
            },
          }),
        );

        // Load user's projects from Firestore
        const projQuery = query(
          collection(this.firestore, 'user_projects'),
          where('uid', '==', user.uid),
        );
        this.subscriptions.add(
          (collectionData(projQuery, { idField: 'id' }) as any).subscribe({
            next: (items: UserProjectItem[]) => {
              this.projects.set(items || []);
              if (items?.length && !this.selectedProjectId()) {
                this.selectProject(items[0]);
              }
            },
            error: (err: unknown) => {
              console.error('Failed to load user projects:', err);
            },
          }),
        );

        // Load user's saved requirements timeline from Firestore
        const reqQuery = query(
          collection(this.firestore, 'user_requirements'),
          where('uid', '==', user.uid),
        );
        this.subscriptions.add(
          (collectionData(reqQuery, { idField: 'id' }) as any).subscribe({
            next: (items: ProjectRequirementItem[]) => {
              this.requirements.set(items || []);
              if (items?.length && !this.selectedRequirementId()) {
                this.selectRequirement(items[0]);
              }
            },
            error: (err: unknown) => {
              console.error('Failed to load user requirements:', err);
            },
          }),
        );

        // Load saved profile & project requirement from Firestore
        const profileRef = doc(this.firestore, 'user_profiles', user.uid);
        this.subscriptions.add(
          docData(profileRef).subscribe({
            next: (data: any) => {
              if (!data) {
                if (this.alternativeDomains.length === 0) {
                  this.addAlternativeDomain('');
                }
                return;
              }
              this.profileForm.patchValue({
                fullName: data.fullName || user.displayName || '',
                email: data.email || user.email || '',
                phoneNumber: data.phoneNumber || '',
                contactAddress: data.contactAddress || '',
                expectedCompletionDate: data.expectedCompletionDate || '',
                projectBudget: data.projectBudget || '',
                businessType: data.businessType || 'E-commerce / Online Store',
                primaryDomain: data.primaryDomain || '',
                projectDescription: data.projectDescription || '',
                selectedTemplate: data.selectedTemplate || 'modern-commerce',
              });
              if (data.photoURL) {
                this.customPhotoUrl.set(data.photoURL);
              }
              if (data.status === 'submitted' || data.status === 'draft') {
                this.submissionStatus.set(data.status);
              }

              this.alternativeDomains.clear();
              const domains: string[] = Array.isArray(data.alternativeDomains)
                ? data.alternativeDomains
                : [];
              if (domains.length > 0) {
                domains.forEach((d) => this.alternativeDomains.push(this.fb.nonNullable.control(d)));
              } else {
                this.addAlternativeDomain('');
              }
            },
            error: (err) => {
              console.error('Failed to load profile from Firestore:', err);
              if (this.alternativeDomains.length === 0) {
                this.addAlternativeDomain('');
              }
            },
          }),
        );
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  toggleTopMenu(event: Event): void {
    event.stopPropagation();
    this.isTopMenuOpen.update((v) => !v);
  }

  getInitial(name?: string | null, email?: string | null): string {
    return (name || email || 'U').trim().charAt(0).toUpperCase();
  }

  addAlternativeDomain(initialValue = ''): void {
    this.alternativeDomains.push(this.fb.nonNullable.control(initialValue));
  }

  removeAlternativeDomain(index: number): void {
    this.alternativeDomains.removeAt(index);
  }

  async uploadAvatar(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.showStatus('Uploading profile photo...', 'info');
    try {
      const url = await this.websiteData.uploadImage(file);
      this.customPhotoUrl.set(url);
      this.showStatus('Profile photo uploaded. Save to persist.', 'success');
    } catch (err) {
      console.error(err);
      this.showStatus('Photo upload failed. Check Firebase Storage rules.', 'error');
    } finally {
      input.value = '';
    }
  }

  applyDescriptionFormat(action: 'bold' | 'italic' | 'underline' | 'bullet' | 'quote' | 'clear'): void {
    const ctrl = this.profileForm.controls.projectDescription;
    const current = ctrl.value || '';
    if (action === 'clear') {
      ctrl.setValue('');
      return;
    }
    const snippets: Record<string, string> = {
      bold: '**Important requirement**',
      italic: '_Preferred design note_',
      underline: '__Highlighted feature__',
      bullet: '\n• ',
      quote: '\n> Design preference: Clean, modern, and aligned with my brand.',
    };
    ctrl.setValue(`${current}${current && action !== 'bullet' && action !== 'quote' ? ' ' : ''}${snippets[action]}`);
  }

  generateAiDraft(): void {
    const business = this.profileForm.controls.businessType.value || 'Business Website';
    const domain = this.profileForm.controls.primaryDomain.value || 'mybusiness.com';
    const draft = [
      `Website Requirement (${business})`,
      `I need a modern, mobile-responsive website for ${domain}.`,
      '',
      'Key Requirements:',
      '• Homepage with hero banner and company introduction.',
      '• Products/Services showcase with clear pricing and visuals.',
      '• Online enquiry / contact form with instant notifications.',
      '• Admin panel to manage sections, menus, and content easily.',
      '• SEO-friendly structure and fast loading performance.',
      '',
      'Design Preference: Clean, professional, and matching my brand logo & colors.',
    ].join('\n');
    this.profileForm.controls.projectDescription.setValue(draft);
    this.showStatus('AI requirement draft generated!', 'success');
  }

  useStarterTemplate(): void {
    this.currentStep.set(2);
    this.activeSidebarItem.set('templates');
  }

  goToNextStep(): void {
    const step = this.currentStep();
    if (step === 1) {
      this.currentStep.set(2);
      this.activeSidebarItem.set('templates');
    } else if (step === 2) {
      this.currentStep.set(3);
      this.activeSidebarItem.set('projects');
    } else if (step === 3) {
      void this.saveProfile('submitted');
    }
  }

  selectTemplate(templateId: string): void {
    this.profileForm.controls.selectedTemplate.setValue(templateId);
  }

  getThemeCount(themeId: string): number {
    if (themeId === 'all') return this.templates.length;
    return this.templates.filter((t) => t.themeId === themeId).length;
  }

  toggleFavoriteTemplate(templateId: string, event: Event): void {
    event.stopPropagation();
    this.favoriteTemplateIds.update((list) =>
      list.includes(templateId) ? list.filter((id) => id !== templateId) : [...list, templateId],
    );
  }

  isFavoriteTemplate(templateId: string): boolean {
    return this.favoriteTemplateIds().includes(templateId);
  }

  useTemplateFromGallery(tpl: TemplateCatalogItem): void {
    this.profileForm.controls.selectedTemplate.setValue(tpl.id);
    this.previewingTemplate.set(null);
    this.showStatus(`Selected "${tpl.name}" template for your website!`, 'success');
  }

  // ---- SUPPORT CENTER METHODS ----
  async startNewSupportChat(initialTitle = 'New Support Chat'): Promise<void> {
    const uid = this.currentUid();
    if (!uid) return;
    const id = `chat_${Date.now().toString(36)}`;
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const conv: SupportConversation = {
      id,
      uid,
      title: initialTitle,
      status: 'open',
      icon: 'fa-headset',
      messages: [
        {
          id: `msg_${Date.now().toString(36)}`,
          sender: 'ai',
          senderName: 'Dysi AI Assistant',
          text: 'Hello! How can I help you with your Dysi website, templates, or bookings today?',
          time: nowTime,
        },
      ],
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(this.firestore, 'support_chats', id), conv, { merge: true });
      this.selectedConversationId.set(id);
      this.supportTab.set('chat');
    } catch (err) {
      console.error('Failed to start support chat:', err);
      this.showStatus('Could not start chat. Check Firestore permissions.', 'error');
    }
  }

  async sendSupportMessage(): Promise<void> {
    const uid = this.currentUid();
    const text = this.supportMessageInput().trim();
    if (!uid || !text) return;

    let conv = this.selectedConversation();
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const userMsg: SupportChatMessage = {
      id: `msg_${Date.now().toString(36)}_u`,
      sender: 'user',
      senderName: this.profileForm.controls.fullName.value || 'You',
      text,
      time: nowTime,
    };

    const aiReply: SupportChatMessage = {
      id: `msg_${Date.now().toString(36)}_a`,
      sender: 'ai',
      senderName: 'Dysi AI Assistant',
      text: this.buildSupportAiReply(text),
      time: nowTime,
    };

    const id = conv?.id || `chat_${Date.now().toString(36)}`;
    const title =
      conv && conv.title !== 'New Support Chat'
        ? conv.title
        : text.length > 32
          ? text.slice(0, 32) + '...'
          : text;

    const updated: SupportConversation = {
      id,
      uid,
      title,
      status: conv?.status || 'open',
      icon: conv?.icon || 'fa-headset',
      messages: [...(conv?.messages || []), userMsg, aiReply],
      updatedAt: serverTimestamp(),
    };

    this.supportMessageInput.set('');
    try {
      await setDoc(doc(this.firestore, 'support_chats', id), updated, { merge: true });
      this.selectedConversationId.set(id);
    } catch (err) {
      console.error('Failed to send message:', err);
      this.showStatus('Could not send message.', 'error');
    }
  }

  async escalateToTeam(): Promise<void> {
    const conv = this.selectedConversation();
    if (!conv) return;
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const teamMsg: SupportChatMessage = {
      id: `msg_${Date.now().toString(36)}_t`,
      sender: 'team',
      senderName: 'Support Team',
      text: `Hello ${this.profileForm.controls.fullName.value || 'there'}! A Dysi support specialist has joined this conversation. Could you share your project name or domain so we can assist right away?`,
      time: nowTime,
    };

    try {
      await setDoc(
        doc(this.firestore, 'support_chats', conv.id),
        {
          status: 'escalated',
          messages: [...(conv.messages || []), teamMsg],
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      this.showStatus('Escalated to Dysi Support Team.', 'success');
    } catch (err) {
      console.error('Escalation failed:', err);
    }
  }

  async clearAllSupportHistory(): Promise<void> {
    const list = this.supportConversations();
    if (!list.length) return;
    if (!window.confirm('Clear all support chat history? This cannot be undone.')) return;
    try {
      await Promise.all(list.map((c) => deleteDoc(doc(this.firestore, 'support_chats', c.id))));
      this.selectedConversationId.set(null);
      this.showStatus('Support history cleared.', 'info');
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  }

  async submitContactSupport(): Promise<void> {
    const uid = this.currentUid();
    const subject = this.contactSubject().trim();
    const msg = this.contactMessage().trim();
    if (!uid || !subject || !msg) return;
    const id = `chat_${Date.now().toString(36)}`;
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const conv: SupportConversation = {
      id,
      uid,
      title: subject,
      status: 'escalated',
      icon: 'fa-envelope',
      messages: [
        {
          id: `msg_${Date.now().toString(36)}_u`,
          sender: 'user',
          senderName: this.profileForm.controls.fullName.value || 'You',
          text: msg,
          time: nowTime,
        },
        {
          id: `msg_${Date.now().toString(36)}_t`,
          sender: 'team',
          senderName: 'Support Team',
          text: 'Thanks for reaching out! Your support ticket has been logged and our team will respond shortly.',
          time: nowTime,
        },
      ],
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(this.firestore, 'support_chats', id), conv, { merge: true });
      this.contactSubject.set('');
      this.contactMessage.set('');
      this.selectedConversationId.set(id);
      this.supportTab.set('chat');
      this.showStatus('Support ticket submitted!', 'success');
    } catch (err) {
      console.error(err);
    }
  }

  getLastMessagePreview(conv: SupportConversation): string {
    const last = conv.messages?.[conv.messages.length - 1];
    if (!last) return 'No messages yet';
    const prefix = last.sender === 'user' ? 'You: ' : last.sender === 'ai' ? 'AI: ' : 'Support: ';
    return prefix + last.text;
  }

  private buildSupportAiReply(prompt: string): string {
    const lower = prompt.toLowerCase();
    if (lower.includes('booking') || lower.includes('seat')) {
      return 'You can configure booking forms and bus seat layouts (2+2 or 3+2) in Admin → Booking Settings. Would you like me to escalate this to our support team for custom setup?';
    }
    if (lower.includes('domain') || lower.includes('dns')) {
      return 'To connect a custom domain, go to Admin → Settings and add your domain CNAME pointing to dysi.web.app. Click "Escalate to Team" if you need live DNS help.';
    }
    if (lower.includes('template') || lower.includes('theme')) {
      return 'You can browse ready-made business themes in the Templates tab and click "Use Template" to apply one to your project requirement.';
    }
    return 'Thanks for your question! I have noted your request. You can click "Escalate to Team" at the top right anytime to connect directly with a Dysi support specialist.';
  }

  getSelectedTemplateName(): string {
    const id = this.profileForm.controls.selectedTemplate.value;
    return this.templates.find((t) => t.id === id)?.name || 'Modern E-Commerce Pro';
  }

  resetForm(): void {
    const email = this.profileForm.controls.email.value;
    this.profileForm.reset({
      fullName: '',
      email,
      phoneNumber: '',
      contactAddress: '',
      expectedCompletionDate: '',
      projectBudget: '',
      businessType: 'E-commerce / Online Store',
      primaryDomain: '',
      projectDescription: '',
      selectedTemplate: 'modern-commerce',
    });
    this.alternativeDomains.clear();
    this.addAlternativeDomain('');
    this.showStatus('Form fields cleared.', 'info');
  }

  async saveProfile(status: 'draft' | 'submitted'): Promise<void> {
    const uid = this.currentUid();
    if (!uid) {
      this.showStatus('Please sign in first to save your profile.', 'error');
      return;
    }
    if (status === 'submitted' && this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.showStatus('Please complete required fields before submitting.', 'error');
      return;
    }

    this.isSaving.set(true);
    try {
      const raw = this.profileForm.getRawValue();
      const payload: UserProfileRequirement = {
        uid,
        fullName: raw.fullName,
        email: raw.email,
        phoneNumber: raw.phoneNumber,
        contactAddress: raw.contactAddress,
        photoURL: this.customPhotoUrl(),
        expectedCompletionDate: raw.expectedCompletionDate,
        projectBudget: raw.projectBudget,
        businessType: raw.businessType,
        primaryDomain: raw.primaryDomain,
        alternativeDomains: (raw.alternativeDomains as string[])
          .map((d) => d.trim())
          .filter(Boolean),
        projectDescription: raw.projectDescription,
        selectedTemplate: raw.selectedTemplate,
        status,
        updatedAt: serverTimestamp(),
      };

      const profileRef = doc(this.firestore, 'user_profiles', uid);
      await setDoc(profileRef, payload, { merge: true });

      // Also record in user_requirements timeline collection
      const reqId = this.selectedRequirementId() || `req_${Date.now().toString(36)}`;
      const reqTitle =
        raw.primaryDomain
          ? `${raw.businessType} (${raw.primaryDomain})`
          : `${raw.businessType} Website`;
      const reqItem: ProjectRequirementItem = {
        id: reqId,
        uid,
        title: reqTitle,
        businessType: raw.businessType,
        primaryDomain: raw.primaryDomain,
        alternativeDomains: payload.alternativeDomains,
        projectDescription: raw.projectDescription,
        expectedCompletionDate: raw.expectedCompletionDate,
        projectBudget: raw.projectBudget,
        selectedTemplate: raw.selectedTemplate,
        status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(this.firestore, 'user_requirements', reqId), reqItem, { merge: true });
      this.selectedRequirementId.set(reqId);

      this.submissionStatus.set(status);
      if (status === 'submitted') {
        this.currentStep.set(4);
        this.showStatus('Project requirement submitted successfully!', 'success');
      } else {
        this.showStatus('Profile & requirement saved as draft.', 'success');
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      this.showStatus('Could not save profile. Check Firestore permissions.', 'error');
    } finally {
      this.isSaving.set(false);
    }
  }

  async signInWithGoogle(): Promise<void> {
    try {
      await this.websiteData.signInWithGoogle();
    } catch (err) {
      console.error(err);
      this.showStatus('Google sign-in failed.', 'error');
    }
  }

  async signOut(): Promise<void> {
    this.isTopMenuOpen.set(false);
    await this.websiteData.signOut();
    void this.router.navigate(['/']);
  }

  // ---- MY REQUIREMENTS TIMELINE METHODS ----
  selectRequirement(item: ProjectRequirementItem): void {
    this.selectedRequirementId.set(item.id);
    this.reqEditorTitle.set(item.title || '');
    this.reqEditorBusinessType.set(item.businessType || 'E-commerce / Online Store');
    this.reqEditorPrimaryDomain.set(item.primaryDomain || '');
    this.reqEditorAltDomains.set((item.alternativeDomains || []).join(', '));
    this.reqEditorDescription.set(item.projectDescription || '');
  }

  startNewRequirement(): void {
    const newId = `req_${Date.now().toString(36)}`;
    this.selectedRequirementId.set(newId);
    this.reqEditorTitle.set('New Website Requirement');
    this.reqEditorBusinessType.set('E-commerce / Online Store');
    this.reqEditorPrimaryDomain.set('');
    this.reqEditorAltDomains.set('');
    this.reqEditorDescription.set('');
    this.activeSidebarItem.set('requirements');
    this.showStatus('Started a new requirement draft. Fill in details and save.', 'info');
  }

  applyReqFormat(action: 'bold' | 'italic' | 'underline' | 'bullet' | 'clear'): void {
    const current = this.reqEditorDescription();
    if (action === 'clear') {
      this.reqEditorDescription.set('');
      return;
    }
    const map: Record<string, string> = {
      bold: '**Key Feature**',
      italic: '_Design note_',
      underline: '__Highlight__',
      bullet: '\n• ',
    };
    this.reqEditorDescription.set(`${current}${current && action !== 'bullet' ? ' ' : ''}${map[action]}`);
  }

  generateReqAiDraft(): void {
    const title = this.reqEditorTitle() || this.reqEditorBusinessType();
    const domain = this.reqEditorPrimaryDomain() || 'mybusiness.com';
    const draft = [
      `Website Requirement`,
      `I need a modern and responsive website for ${title} (${domain}).`,
      '',
      'Key Features:',
      '• Home page with hero banner, offers, and highlights.',
      '• Products / Services catalog with categories and search.',
      '• Online enquiry / booking form with instant notifications.',
      '• Admin panel to manage content, images, and inquiries.',
      '• Mobile-friendly and SEO-optimized performance.',
    ].join('\n');
    this.reqEditorDescription.set(draft);
    this.showStatus('AI requirement draft generated.', 'success');
  }

  async saveSelectedRequirement(status: 'draft' | 'submitted'): Promise<void> {
    const uid = this.currentUid();
    if (!uid) return;
    const id = this.selectedRequirementId() || `req_${Date.now().toString(36)}`;
    this.isSaving.set(true);
    try {
      const altDomains = this.reqEditorAltDomains()
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
      const existing = this.requirements().find((r) => r.id === id);
      const payload: ProjectRequirementItem = {
        id,
        uid,
        title: this.reqEditorTitle().trim() || `${this.reqEditorBusinessType()} Website`,
        businessType: this.reqEditorBusinessType(),
        primaryDomain: this.reqEditorPrimaryDomain().trim(),
        alternativeDomains: altDomains,
        projectDescription: this.reqEditorDescription(),
        status,
        createdAt: existing?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(this.firestore, 'user_requirements', id), payload, { merge: true });
      this.selectedRequirementId.set(id);
      this.showStatus(
        status === 'submitted' ? 'Requirement submitted successfully!' : 'Requirement saved as draft.',
        'success',
      );
    } catch (err) {
      console.error('Failed to save requirement:', err);
      this.showStatus('Failed to save requirement. Check Firestore permissions.', 'error');
    } finally {
      this.isSaving.set(false);
    }
  }

  async deleteRequirement(item: ProjectRequirementItem, event: Event): Promise<void> {
    event.stopPropagation();
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    try {
      await deleteDoc(doc(this.firestore, 'user_requirements', item.id));
      if (this.selectedRequirementId() === item.id) {
        this.selectedRequirementId.set(null);
      }
      this.showStatus('Requirement deleted.', 'info');
    } catch (err) {
      console.error('Failed to delete requirement:', err);
      this.showStatus('Could not delete requirement.', 'error');
    }
  }

  formatReqTime(value: any): string {
    const d = this.toDate(value);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  formatReqFullDate(value: any): string {
    const d = this.toDate(value);
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${this.formatReqTime(value)}`;
  }

  getReqStatusLabel(status?: string): string {
    if (status === 'approved') return 'Approved';
    if (status === 'submitted') return 'Submitted';
    return 'Draft (Saved)';
  }

  // ---- MY PROJECTS METHODS ----
  selectProject(proj: UserProjectItem): void {
    this.selectedProjectId.set(proj.id);
    this.projectNotesDraft.set(proj.notes || '');
    this.editProjStatus.set(proj.status);
    this.editProjDomain.set(proj.domain || '');
    this.editProjExpectedDate.set(proj.expectedCompletion || '');
    this.editProjDescription.set(proj.description || '');
    this.showAddReleaseForm.set(false);
  }

  async createProject(): Promise<void> {
    const uid = this.currentUid();
    if (!uid || this.newProjectForm.invalid) return;
    const val = this.newProjectForm.getRawValue();
    const id = `proj_${Date.now().toString(36)}`;
    const todayStr = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const newProj: UserProjectItem = {
      id,
      uid,
      name: val.name.trim(),
      domain: val.domain.trim() || 'www.mywebsite.com',
      description: val.description.trim() || 'Custom website project managed on Dysi.',
      thumbnailUrl: val.thumbnailUrl.trim(),
      status: val.status,
      startedDate: todayStr,
      expectedCompletion: val.expectedCompletion || 'TBD',
      lastReleaseDate: todayStr,
      latestFeature: 'Initial project setup',
      releases: [
        {
          version: 'v1.0.0',
          date: todayStr,
          title: 'Initial Release',
          changes: ['Project setup & initial configuration'],
          isCurrent: true,
        },
      ],
      features: [
        { label: 'Responsive homepage & navigation', done: true },
        { label: 'Admin CMS & content management', done: false },
      ],
      notes: '',
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(this.firestore, 'user_projects', id), newProj, { merge: true });
      this.newProjectForm.reset({
        name: '',
        domain: '',
        description: '',
        thumbnailUrl: '',
        status: 'Not Started',
        expectedCompletion: '',
      });
      this.showNewProjectForm.set(false);
      this.selectProject(newProj);
      this.showStatus('New project created successfully!', 'success');
    } catch (err) {
      console.error('Failed to create project:', err);
      this.showStatus('Could not create project. Check Firestore permissions.', 'error');
    }
  }

  async addProjectRelease(): Promise<void> {
    const proj = this.selectedProject();
    if (!proj || this.newReleaseForm.invalid) return;
    const val = this.newReleaseForm.getRawValue();
    const todayStr = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const changes = val.changesText
      .split('\n')
      .map((line) => line.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean);
    const updatedReleases: ProjectReleaseItem[] = [
      {
        version: val.version.trim(),
        date: todayStr,
        title: val.title.trim(),
        changes: changes.length ? changes : ['Feature update & improvements'],
        isCurrent: true,
      },
      ...(proj.releases || []).map((r) => ({ ...r, isCurrent: false })),
    ];

    try {
      await setDoc(
        doc(this.firestore, 'user_projects', proj.id),
        {
          releases: updatedReleases,
          lastReleaseDate: todayStr,
          latestFeature: val.title.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      this.newReleaseForm.reset({ version: '', title: '', changesText: '' });
      this.showAddReleaseForm.set(false);
      this.showStatus('Release added to project history.', 'success');
    } catch (err) {
      console.error(err);
      this.showStatus('Failed to add release.', 'error');
    }
  }

  async saveProjectDetails(): Promise<void> {
    const proj = this.selectedProject();
    if (!proj) return;
    try {
      await setDoc(
        doc(this.firestore, 'user_projects', proj.id),
        {
          status: this.editProjStatus(),
          domain: this.editProjDomain().trim(),
          expectedCompletion: this.editProjExpectedDate().trim(),
          description: this.editProjDescription().trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      this.showStatus('Project details updated.', 'success');
    } catch (err) {
      console.error(err);
      this.showStatus('Failed to update project details.', 'error');
    }
  }

  async addProjectFeature(): Promise<void> {
    const proj = this.selectedProject();
    const label = this.newFeatureText().trim();
    if (!proj || !label) return;
    const updated = [...(proj.features || []), { label, done: false }];
    try {
      await setDoc(
        doc(this.firestore, 'user_projects', proj.id),
        { features: updated, updatedAt: serverTimestamp() },
        { merge: true },
      );
      this.newFeatureText.set('');
    } catch (err) {
      console.error(err);
    }
  }

  async toggleProjectFeature(index: number): Promise<void> {
    const proj = this.selectedProject();
    if (!proj) return;
    const updated = (proj.features || []).map((f, i) => (i === index ? { ...f, done: !f.done } : f));
    try {
      await setDoc(
        doc(this.firestore, 'user_projects', proj.id),
        { features: updated, updatedAt: serverTimestamp() },
        { merge: true },
      );
    } catch (err) {
      console.error(err);
    }
  }

  async saveProjectNotes(): Promise<void> {
    const proj = this.selectedProject();
    if (!proj) return;
    try {
      await setDoc(
        doc(this.firestore, 'user_projects', proj.id),
        { notes: this.projectNotesDraft(), updatedAt: serverTimestamp() },
        { merge: true },
      );
      this.showStatus('Project notes saved.', 'success');
    } catch (err) {
      console.error(err);
      this.showStatus('Failed to save project notes.', 'error');
    }
  }

  getProjectStatusClass(status?: ProjectStatusType): string {
    switch (status) {
      case 'In Progress':
        return 'proj-status--progress';
      case 'Completed':
        return 'proj-status--completed';
      case 'Upgrading':
        return 'proj-status--upgrading';
      default:
        return 'proj-status--not-started';
    }
  }

  private toDate(value: any): Date {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
    return new Date(value);
  }

  private showStatus(message: string, type: 'success' | 'error' | 'info'): void {
    this.statusMessage.set(message);
    this.statusType.set(type);
  }
}
