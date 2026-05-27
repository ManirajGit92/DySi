import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ContentCard, FaqItem, FooterSettings, MenuItem, WebsiteSection } from '../../core/models/website.models';
import {
  WebsiteDataService,
  defaultFooterSettings,
  defaultThemeSettings,
} from '../../core/services/website-data.service';
import { DynamicSectionComponent } from '../../shared/dynamic-section/dynamic-section';

@Component({
  selector: 'app-admin',
  imports: [CommonModule, AsyncPipe, ReactiveFormsModule, RouterLink, DynamicSectionComponent],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class AdminComponent {
  private readonly fb = inject(FormBuilder);
  private readonly websiteData = inject(WebsiteDataService);

  readonly user$ = this.websiteData.user$;
  readonly menus$ = this.websiteData.allMenus$;
  readonly sections$ = this.websiteData.allSections$;
  readonly themeSettings$ = this.websiteData.themeSettings$;
  readonly footerSettings$ = this.websiteData.footerSettings$;
  readonly activeTab = signal<'menus' | 'sections' | 'theme' | 'footer'>('sections');
  readonly status = signal('');
  readonly uploadStatus = signal('');
  readonly previewSection = signal<WebsiteSection | null>(null);

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.email]],
    password: [''],
  });

  readonly menuForm = this.fb.nonNullable.group({
    id: [''],
    title: ['', Validators.required],
    routeKey: ['', Validators.required],
    order: [1, Validators.required],
    isVisible: [true],
    sectionId: ['', Validators.required],
  });

  readonly sectionForm = this.fb.nonNullable.group({
    id: [''],
    sectionId: ['', Validators.required],
    title: ['', Validators.required],
    subtitle: [''],
    description: [''],
    imageUrl: [''],
    buttonText: [''],
    buttonLink: [''],
    backgroundColor: [''],
    textColor: [''],
    fontFamily: ['Inter'],
    fontSize: ['16px'],
    layoutType: ['default' as WebsiteSection['layoutType']],
    isDarkSection: [false],
    isVisible: [true],
    order: [1, Validators.required],
    cardsJson: ['[]'],
    faqsJson: ['[]'],
    galleryJson: ['[]'],
  });

  readonly themeForm = this.fb.nonNullable.group({
    primaryColor: [defaultThemeSettings.primaryColor],
    secondaryColor: [defaultThemeSettings.secondaryColor],
    backgroundColor: [defaultThemeSettings.backgroundColor],
    textColor: [defaultThemeSettings.textColor],
    buttonColor: [defaultThemeSettings.buttonColor],
    fontFamily: [defaultThemeSettings.fontFamily],
    fontSize: [defaultThemeSettings.fontSize],
    fontWeight: [defaultThemeSettings.fontWeight],
    letterSpacing: [defaultThemeSettings.letterSpacing],
    lineHeight: [defaultThemeSettings.lineHeight],
    sectionSpacing: [defaultThemeSettings.sectionSpacing],
    borderRadius: [defaultThemeSettings.borderRadius],
    cardShadow: [defaultThemeSettings.cardShadow],
    containerWidth: [defaultThemeSettings.containerWidth],
    themeMode: [defaultThemeSettings.themeMode],
  });

  readonly footerForm = this.fb.nonNullable.group({
    description: [defaultFooterSettings.description],
    importantLinksJson: [JSON.stringify(defaultFooterSettings.importantLinks, null, 2)],
    socialLinksJson: [JSON.stringify(defaultFooterSettings.socialLinks, null, 2)],
    copyright: [defaultFooterSettings.copyright],
  });

  constructor() {
    this.sectionForm.valueChanges.subscribe(() => this.previewSection.set(this.buildSectionFromForm(false)));
    this.themeSettings$.subscribe((settings) => this.themeForm.patchValue(settings, { emitEvent: false }));
    this.footerSettings$.subscribe((settings) => {
      this.footerForm.patchValue(
        {
          description: settings.description,
          importantLinksJson: JSON.stringify(settings.importantLinks, null, 2),
          socialLinksJson: JSON.stringify(settings.socialLinks, null, 2),
          copyright: settings.copyright,
        },
        { emitEvent: false },
      );
    });
  }

  async signInWithGoogle(): Promise<void> {
    await this.runTask(() => this.websiteData.signInWithGoogle(), 'Signed in with Google.');
  }

  async signInWithEmail(): Promise<void> {
    const { email, password } = this.loginForm.getRawValue();
    await this.runTask(() => this.websiteData.signInWithEmail(email, password), 'Signed in.');
  }

  async registerWithEmail(): Promise<void> {
    const { email, password } = this.loginForm.getRawValue();
    await this.runTask(() => this.websiteData.registerWithEmail(email, password), 'Admin account created.');
  }

  async signOut(): Promise<void> {
    await this.runTask(() => this.websiteData.signOut(), 'Signed out.');
  }

  editMenu(menu: MenuItem): void {
    this.menuForm.patchValue(menu);
    this.activeTab.set('menus');
  }

  async saveMenu(): Promise<void> {
    await this.runTask(() => this.websiteData.upsertMenu(this.menuForm.getRawValue()), 'Menu saved.');
    this.menuForm.reset({ id: '', title: '', routeKey: '', order: 1, isVisible: true, sectionId: '' });
  }

  async deleteMenu(menu: MenuItem): Promise<void> {
    if (menu.id) {
      await this.runTask(() => this.websiteData.deleteMenu(menu.id!), 'Menu deleted.');
    }
  }

  editSection(section: WebsiteSection): void {
    this.sectionForm.patchValue({
      ...section,
      cardsJson: JSON.stringify(section.cards ?? [], null, 2),
      faqsJson: JSON.stringify(section.faqs ?? [], null, 2),
      galleryJson: JSON.stringify(section.gallery ?? [], null, 2),
    });
    this.previewSection.set(section);
    this.activeTab.set('sections');
  }

  async saveSection(): Promise<void> {
    const section = this.buildSectionFromForm(true);
    if (!section) {
      return;
    }
    await this.runTask(() => this.websiteData.upsertSection(section), 'Section saved.');
  }

  async deleteSection(section: WebsiteSection): Promise<void> {
    if (section.id) {
      await this.runTask(() => this.websiteData.deleteSection(section.id!), 'Section deleted.');
    }
  }

  async uploadImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.uploadStatus.set('Uploading image...');
    try {
      const url = await this.websiteData.uploadImage(file);
      this.sectionForm.patchValue({ imageUrl: url });
      this.uploadStatus.set('Image uploaded and attached.');
    } catch (error) {
      this.uploadStatus.set('Image upload failed. Check Firebase Storage rules.');
      console.error(error);
    }
  }

  async saveTheme(): Promise<void> {
    await this.runTask(() => this.websiteData.saveThemeSettings({ id: 'global', ...this.themeForm.getRawValue() }), 'Theme saved.');
  }

  async saveFooter(): Promise<void> {
    const value = this.footerForm.getRawValue();
    const settings: FooterSettings = {
      id: 'global',
      description: value.description,
      importantLinks: this.parseJson(value.importantLinksJson, defaultFooterSettings.importantLinks),
      socialLinks: this.parseJson(value.socialLinksJson, defaultFooterSettings.socialLinks),
      copyright: value.copyright,
    };
    await this.runTask(() => this.websiteData.saveFooterSettings(settings), 'Footer saved.');
  }

  async seedDefaults(): Promise<void> {
    await this.runTask(() => this.websiteData.seedDefaultWebsite(), 'Default menus, sections, theme, and footer saved.');
  }

  private buildSectionFromForm(showErrors: boolean): WebsiteSection | null {
    const value = this.sectionForm.getRawValue();
    const cards = this.parseJson<ContentCard[]>(value.cardsJson, []);
    const faqs = this.parseJson<FaqItem[]>(value.faqsJson, []);
    const gallery = this.parseJson<string[]>(value.galleryJson, []);

    if (showErrors && (!Array.isArray(cards) || !Array.isArray(faqs) || !Array.isArray(gallery))) {
      this.status.set('Cards, FAQ, and Gallery fields must contain valid JSON arrays.');
      return null;
    }

    return {
      id: value.id || value.sectionId,
      sectionId: value.sectionId,
      title: value.title,
      subtitle: value.subtitle,
      description: value.description,
      imageUrl: value.imageUrl,
      buttonText: value.buttonText,
      buttonLink: value.buttonLink,
      backgroundColor: value.backgroundColor,
      textColor: value.textColor,
      fontFamily: value.fontFamily,
      fontSize: value.fontSize,
      layoutType: value.layoutType,
      isDarkSection: value.isDarkSection,
      isVisible: value.isVisible,
      order: value.order,
      cards,
      faqs,
      gallery,
    };
  }

  private parseJson<T>(value: string, fallback: T): T {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  private async runTask(action: () => Promise<unknown>, success: string): Promise<void> {
    this.status.set('Saving...');
    try {
      await action();
      this.status.set(success);
    } catch (error) {
      this.status.set('Something went wrong. Check Firebase rules and form values.');
      console.error(error);
    }
  }
}
