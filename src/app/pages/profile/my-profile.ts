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

  readonly templates = [
    {
      id: 'modern-commerce',
      name: 'Modern E-Commerce Pro',
      category: 'E-commerce / Online Store',
      description: 'Conversion-focused storefront with product showcase, cart, and order tracking.',
      accent: 'linear-gradient(135deg, #6d28d9, #9333ea)',
      icon: 'fa-bag-shopping',
    },
    {
      id: 'travel-explorer',
      name: 'Travel & Tour Explorer',
      category: 'Travel & Tour Bookings',
      description: 'Hero destination carousel, bus/tour seat booking, and package comparisons.',
      accent: 'linear-gradient(135deg, #2563eb, #7c3aed)',
      icon: 'fa-plane-departure',
    },
    {
      id: 'corporate-saas',
      name: 'Corporate SaaS Suite',
      category: 'Corporate / Business Website',
      description: 'Clean executive landing page with services, testimonials, FAQ, and enquiry form.',
      accent: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
      icon: 'fa-building',
    },
    {
      id: 'creative-studio',
      name: 'Creative Portfolio Studio',
      category: 'Portfolio / Personal Brand',
      description: 'Visual-first gallery layout crafted for agencies, designers, and creators.',
      accent: 'linear-gradient(135deg, #db2777, #7c3aed)',
      icon: 'fa-palette',
    },
  ];

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
