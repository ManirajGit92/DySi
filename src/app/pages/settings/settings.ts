import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';
import { SliderModule } from 'primeng/slider';
import { DialogModule } from 'primeng/dialog';

import {
  ContentCard,
  FaqItem,
  FooterSettings,
  HeaderSettings,
  MenuItem,
  ThemeSettings,
  WebsiteSection,
  HeroSlide,
} from '../../core/models/website.models';
import {
  WebsiteDataService,
  defaultFooterSettings,
  defaultHeaderSettings,
  defaultThemeSettings,
} from '../../core/services/website-data.service';
import { DynamicSectionComponent } from '../../shared/dynamic-section/dynamic-section';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, AsyncPipe, ReactiveFormsModule, DynamicSectionComponent, SliderModule, DialogModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  private readonly fb = inject(FormBuilder);
  private readonly websiteData = inject(WebsiteDataService);
  private readonly router = inject(Router);

  readonly user$ = this.websiteData.user$;
  readonly menus$ = this.websiteData.allMenus$;
  readonly sections$ = this.websiteData.allSections$;
  readonly themeSettings$ = this.websiteData.themeSettings$;
  readonly footerSettings$ = this.websiteData.footerSettings$;
  readonly headerSettings$ = this.websiteData.headerSettings$;
  readonly activeTab = signal<'menus' | 'sections' | 'theme' | 'footer' | 'header'>('sections');
  readonly status = signal('');
  readonly uploadStatus = signal('');
  readonly excelStatus = signal('');
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
    bgTransparency: [22],
    cardsJson: ['[]'],
    faqsJson: ['[]'],
    galleryJson: ['[]'],
  });

  // Slide management state
  readonly editorSlides = signal<HeroSlide[]>([]);
  readonly isSlideDialogOpen = signal(false);
  readonly editingSlideIndex = signal<number | null>(null);
  readonly uploadSlideStatus = signal('');

  readonly slideForm = this.fb.nonNullable.group({
    imageUrl: ['', Validators.required],
    title: ['', Validators.required],
    subtitle: [''],
    description: [''],
    buttonText: [''],
    buttonLink: [''],
    textPosition: ['left' as 'left' | 'center' | 'right'],
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
    showTopNavMenu: [defaultThemeSettings.showTopNavMenu],
    showHeader: [defaultThemeSettings.showHeader],
    themeMode: [defaultThemeSettings.themeMode],
  });

  readonly footerForm = this.fb.nonNullable.group({
    description: [defaultFooterSettings.description],
    importantLinksJson: [JSON.stringify(defaultFooterSettings.importantLinks, null, 2)],
    socialLinksJson: [JSON.stringify(defaultFooterSettings.socialLinks, null, 2)],
    copyright: [defaultFooterSettings.copyright],
  });

  readonly headerForm = this.fb.nonNullable.group({
    logoUrl: [defaultHeaderSettings.logoUrl],
    websiteName: [defaultHeaderSettings.websiteName, Validators.required],
    logoAlt: [defaultHeaderSettings.logoAlt || ''],
    logoWidth: [defaultHeaderSettings.logoWidth || '32px'],
    logoHeight: [defaultHeaderSettings.logoHeight || '32px'],
    headerWidth: [defaultHeaderSettings.headerWidth || 'fit-content'],
  });

  constructor() {
    this.sectionForm.valueChanges.subscribe(() =>
      this.previewSection.set(this.buildSectionFromForm(false)),
    );
    this.themeSettings$.subscribe((settings) =>
      this.themeForm.patchValue(settings, { emitEvent: false }),
    );
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
    this.headerSettings$.subscribe((settings) =>
      this.headerForm.patchValue(settings, { emitEvent: false }),
    );
  }

  async signInWithGoogle(): Promise<void> {
    await this.runTask(() => this.websiteData.signInWithGoogle(), 'Signed in with Google.');
    await this.checkRoleAndRedirect();
  }

  async signInWithEmail(): Promise<void> {
    const { email, password } = this.loginForm.getRawValue();
    await this.runTask(() => this.websiteData.signInWithEmail(email, password), 'Signed in.');
    await this.checkRoleAndRedirect();
  }

  async registerWithEmail(): Promise<void> {
    const { email, password } = this.loginForm.getRawValue();
    await this.runTask(
      () => this.websiteData.registerWithEmail(email, password),
      'Admin account created.',
    );
    await this.checkRoleAndRedirect();
  }

  private async checkRoleAndRedirect(): Promise<void> {
    try {
      const isSuper = await firstValueFrom(this.websiteData.isSuperAdmin$);
      if (isSuper) {
        void this.router.navigate(['/super-admin']);
        return;
      }
      const isAdmin = await firstValueFrom(this.websiteData.isAdmin$);
      if (isAdmin) {
        return;
      }
      void this.router.navigate(['/']);
    } catch (error) {
      console.error('Error checking role after login', error);
      void this.router.navigate(['/']);
    }
  }

  async signOut(): Promise<void> {
    await this.runTask(() => this.websiteData.signOut(), 'Signed out.');
  }

  editMenu(menu: MenuItem): void {
    this.menuForm.patchValue(menu);
    this.activeTab.set('menus');
  }

  async saveMenu(): Promise<void> {
    await this.runTask(
      () => this.websiteData.upsertMenu(this.menuForm.getRawValue()),
      'Menu saved.',
    );
    this.menuForm.reset({
      id: '',
      title: '',
      routeKey: '',
      order: 1,
      isVisible: true,
      sectionId: '',
    });
  }

  async deleteMenu(menu: MenuItem): Promise<void> {
    if (menu.id) {
      await this.runTask(() => this.websiteData.deleteMenu(menu.id!), 'Menu deleted.');
    }
  }

  editSection(section: WebsiteSection): void {
    this.sectionForm.patchValue({
      ...section,
      bgTransparency: section.bgTransparency !== undefined ? section.bgTransparency : 22,
      cardsJson: JSON.stringify(section.cards ?? [], null, 2),
      faqsJson: JSON.stringify(section.faqs ?? [], null, 2),
      galleryJson: JSON.stringify(section.gallery ?? [], null, 2),
    });
    this.editorSlides.set(section.slides || []);
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

  async uploadLogoImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.uploadStatus.set('Uploading logo...');
    try {
      const url = await this.websiteData.uploadImage(file);
      this.headerForm.patchValue({ logoUrl: url });
      this.uploadStatus.set('Logo uploaded and attached.');
    } catch (error) {
      this.uploadStatus.set('Logo upload failed. Check Firebase Storage rules.');
      console.error(error);
    }
  }

  openAddSlide(): void {
    this.editingSlideIndex.set(null);
    this.slideForm.reset({
      imageUrl: '',
      title: '',
      subtitle: '',
      description: '',
      buttonText: '',
      buttonLink: '',
      textPosition: 'left',
    });
    this.uploadSlideStatus.set('');
    this.isSlideDialogOpen.set(true);
  }

  editSlide(slide: HeroSlide, index: number): void {
    this.editingSlideIndex.set(index);
    this.slideForm.setValue({
      imageUrl: slide.imageUrl || '',
      title: slide.title || '',
      subtitle: slide.subtitle || '',
      description: slide.description || '',
      buttonText: slide.buttonText || '',
      buttonLink: slide.buttonLink || '',
      textPosition: slide.textPosition || 'left',
    });
    this.uploadSlideStatus.set('');
    this.isSlideDialogOpen.set(true);
  }

  saveSlide(): void {
    if (this.slideForm.invalid) {
      return;
    }
    const val = this.slideForm.getRawValue();
    const slides = [...this.editorSlides()];
    const index = this.editingSlideIndex();

    if (index !== null) {
      // Edit existing
      slides[index] = { ...slides[index], ...val };
    } else {
      // Add new
      slides.push({
        id: crypto.randomUUID(),
        ...val,
      });
    }

    this.editorSlides.set(slides);
    this.isSlideDialogOpen.set(false);
    this.previewSection.set(this.buildSectionFromForm(false));
  }

  deleteSlide(index: number): void {
    const slides = [...this.editorSlides()];
    slides.splice(index, 1);
    this.editorSlides.set(slides);
    this.previewSection.set(this.buildSectionFromForm(false));
  }

  moveSlide(index: number, direction: 'up' | 'down'): void {
    const slides = [...this.editorSlides()];
    if (direction === 'up' && index > 0) {
      const temp = slides[index];
      slides[index] = slides[index - 1];
      slides[index - 1] = temp;
    } else if (direction === 'down' && index < slides.length - 1) {
      const temp = slides[index];
      slides[index] = slides[index + 1];
      slides[index + 1] = temp;
    }
    this.editorSlides.set(slides);
    this.previewSection.set(this.buildSectionFromForm(false));
  }

  async uploadSlideImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadSlideStatus.set('Uploading slide image...');
    try {
      const url = await this.websiteData.uploadImage(file);
      this.slideForm.patchValue({ imageUrl: url });
      this.uploadSlideStatus.set('Image uploaded successfully.');
    } catch (error) {
      this.uploadSlideStatus.set('Image upload failed.');
      console.error(error);
    }
  }

  async saveTheme(): Promise<void> {
    await this.runTask(
      () => this.websiteData.saveThemeSettings({ id: 'global', ...this.themeForm.getRawValue() }),
      'Theme saved.',
    );
  }

  async saveFooter(): Promise<void> {
    const value = this.footerForm.getRawValue();
    const settings: FooterSettings = {
      id: 'global',
      description: value.description,
      importantLinks: this.parseJson(
        value.importantLinksJson,
        defaultFooterSettings.importantLinks,
      ),
      socialLinks: this.parseJson(value.socialLinksJson, defaultFooterSettings.socialLinks),
      copyright: value.copyright,
    };
    await this.runTask(() => this.websiteData.saveFooterSettings(settings), 'Footer saved.');
  }

  async saveHeader(): Promise<void> {
    const value = this.headerForm.getRawValue();
    const settings: HeaderSettings = {
      id: 'global',
      logoUrl: value.logoUrl,
      websiteName: value.websiteName,
      logoAlt: value.logoAlt,
      logoWidth: value.logoWidth,
      logoHeight: value.logoHeight,
      headerWidth: value.headerWidth,
    };
    await this.runTask(
      () => this.websiteData.saveHeaderSettings(settings),
      'Header settings saved.',
    );
  }

  async exportSettings(): Promise<void> {
    this.excelStatus.set('Preparing settings export...');
    try {
      const menus = await firstValueFrom(this.menus$);
      const sections = await firstValueFrom(this.sections$);
      const themeList = await firstValueFrom(this.websiteData.themeSettingsDocs$);
      const theme = themeList[0] ?? defaultThemeSettings;

      const footerList = await firstValueFrom(this.websiteData.footerSettingsDocs$);
      const footer = footerList[0] ?? defaultFooterSettings;

      const headerList = await firstValueFrom(this.websiteData.headerSettingsDocs$);
      const header = headerList[0] ?? defaultHeaderSettings;

      const workbook = XLSX.utils.book_new();
      const menuRows = menus.map((menu: MenuItem) => ({
        id: menu.id,
        title: menu.title,
        routeKey: menu.routeKey,
        order: menu.order,
        isVisible: menu.isVisible,
        sectionId: menu.sectionId,
      }));
      const sectionRows = sections.map((section: any) => ({
        id: section.id,
        sectionId: section.sectionId,
        title: section.title,
        subtitle: section.subtitle,
        description: section.description,
        imageUrl: section.imageUrl,
        buttonText: section.buttonText,
        buttonLink: section.buttonLink,
        backgroundColor: section.backgroundColor,
        textColor: section.textColor,
        fontFamily: section.fontFamily,
        fontSize: section.fontSize,
        layoutType: section.layoutType,
        isDarkSection: section.isDarkSection,
        isVisible: section.isVisible,
        order: section.order,
        bgTransparency: section.bgTransparency !== undefined ? section.bgTransparency : 22,
        slides: JSON.stringify(section.slides ?? []),
        cards: JSON.stringify(section.cards ?? []),
        faqs: JSON.stringify(section.faqs ?? []),
        gallery: JSON.stringify(section.gallery ?? []),
      }));
      const themeRows = [theme];
      const footerRows = [
        {
          description: footer.description,
          importantLinks: JSON.stringify(footer.importantLinks),
          socialLinks: JSON.stringify(footer.socialLinks),
          copyright: footer.copyright,
        },
      ];
      const headerRows = [
        {
          logoUrl: header.logoUrl,
          websiteName: header.websiteName,
          logoAlt: header.logoAlt,
          logoWidth: header.logoWidth,
          logoHeight: header.logoHeight,
          headerWidth: header.headerWidth,
        },
      ];

      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(menuRows), 'Menus');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sectionRows), 'Sections');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(themeRows), 'Theme');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(footerRows), 'Footer');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(headerRows), 'Header');

      const excelBuffer = XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
      });
      this.downloadBlob(excelBuffer, 'website-settings.xlsx');
      this.excelStatus.set('Settings exported successfully.');
    } catch (error) {
      console.error(error);
      this.excelStatus.set('Export failed. Check the file format and try again.');
    }
  }

  async importSettings(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.excelStatus.set('Importing settings from Excel...');
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const requiredSheets = ['Menus', 'Sections', 'Theme', 'Footer', 'Header'];
      const missingSheets = requiredSheets.filter((sheet) => !workbook.SheetNames.includes(sheet));
      if (missingSheets.length) {
        throw new Error(`Missing sheets: ${missingSheets.join(', ')}`);
      }

      const menuRows = XLSX.utils.sheet_to_json<MenuItem>(workbook.Sheets['Menus'], {
        defval: '',
      });
      const sectionRows = XLSX.utils.sheet_to_json<Partial<WebsiteSection>>(
        workbook.Sheets['Sections'],
        { defval: '' },
      );
      const themeRows = XLSX.utils.sheet_to_json<ThemeSettings>(workbook.Sheets['Theme'], {
        defval: '',
      });
      const footerRows = XLSX.utils.sheet_to_json<FooterSettings>(workbook.Sheets['Footer'], {
        defval: '',
      });
      const headerRows = XLSX.utils.sheet_to_json<HeaderSettings>(workbook.Sheets['Header'], {
        defval: '',
      });

      if (!themeRows.length || !footerRows.length || !headerRows.length) {
        throw new Error('Theme, Footer, and Header sheets must each contain one row.');
      }

      const normalizeMenu = (menu: MenuItem): MenuItem => ({
        id: menu.id || crypto.randomUUID(),
        title: menu.title || '',
        routeKey: menu.routeKey || '',
        order: Number(menu.order) || 1,
        isVisible: this.parseBoolean(menu.isVisible, true),
        sectionId: menu.sectionId || '',
      });

      const normalizeSection = (section: Partial<WebsiteSection>): WebsiteSection => ({
        id: section.id || section.sectionId || crypto.randomUUID(),
        sectionId: section.sectionId || '',
        title: section.title || '',
        subtitle: section.subtitle || '',
        description: section.description || '',
        imageUrl: section.imageUrl || '',
        buttonText: section.buttonText || '',
        buttonLink: section.buttonLink || '',
        backgroundColor: section.backgroundColor || '',
        textColor: section.textColor || '',
        fontFamily: section.fontFamily || 'Inter',
        fontSize: section.fontSize || '16px',
        layoutType: section.layoutType || 'default',
        isDarkSection: this.parseBoolean(section.isDarkSection, false),
        isVisible: this.parseBoolean(section.isVisible, true),
        order: Number(section.order) || 1,
        bgTransparency: section.bgTransparency !== undefined ? Number(section.bgTransparency) : 22,
        slides: this.parseExcelJson(section.slides, []),
        cards: this.parseExcelJson(section.cards, []),
        faqs: this.parseExcelJson(section.faqs, []),
        gallery: this.parseExcelJson(section.gallery, []),
      });

      const normalizeTheme = (themeData: Partial<ThemeSettings>): ThemeSettings => ({
        id: 'global',
        primaryColor: themeData.primaryColor || defaultThemeSettings.primaryColor,
        secondaryColor: themeData.secondaryColor || defaultThemeSettings.secondaryColor,
        backgroundColor: themeData.backgroundColor || defaultThemeSettings.backgroundColor,
        textColor: themeData.textColor || defaultThemeSettings.textColor,
        buttonColor: themeData.buttonColor || defaultThemeSettings.buttonColor,
        fontFamily: themeData.fontFamily || defaultThemeSettings.fontFamily,
        fontSize: themeData.fontSize || defaultThemeSettings.fontSize,
        fontWeight: themeData.fontWeight || defaultThemeSettings.fontWeight,
        letterSpacing: themeData.letterSpacing || defaultThemeSettings.letterSpacing,
        lineHeight: themeData.lineHeight || defaultThemeSettings.lineHeight,
        sectionSpacing: themeData.sectionSpacing || defaultThemeSettings.sectionSpacing,
        borderRadius: themeData.borderRadius || defaultThemeSettings.borderRadius,
        cardShadow: themeData.cardShadow || defaultThemeSettings.cardShadow,
        containerWidth: themeData.containerWidth || defaultThemeSettings.containerWidth,
        showTopNavMenu: this.parseBoolean(
          themeData.showTopNavMenu,
          defaultThemeSettings.showTopNavMenu,
        ),
        showHeader: this.parseBoolean(themeData.showHeader, defaultThemeSettings.showHeader),
        themeMode: themeData.themeMode || defaultThemeSettings.themeMode,
      });

      const normalizeFooter = (footerData: Partial<FooterSettings>): FooterSettings => ({
        id: 'global',
        description: footerData.description || defaultFooterSettings.description,
        importantLinks: this.parseExcelJson(
          footerData.importantLinks,
          defaultFooterSettings.importantLinks,
        ),
        socialLinks: this.parseExcelJson(footerData.socialLinks, defaultFooterSettings.socialLinks),
        copyright: footerData.copyright || defaultFooterSettings.copyright,
      });

      const normalizeHeader = (headerData: Partial<HeaderSettings>): HeaderSettings => ({
        id: 'global',
        logoUrl: headerData.logoUrl || '',
        websiteName: headerData.websiteName || defaultHeaderSettings.websiteName,
        logoAlt: headerData.logoAlt || '',
        logoWidth: headerData.logoWidth || '32px',
        logoHeight: headerData.logoHeight || '32px',
        headerWidth: headerData.headerWidth || 'fit-content',
      });

      await Promise.all([
        ...menuRows.map((menu: any) => this.websiteData.upsertMenu(normalizeMenu(menu))),
        ...sectionRows.map((section: any) =>
          this.websiteData.upsertSection(normalizeSection(section)),
        ),
      ]);
      await this.websiteData.saveThemeSettings(normalizeTheme(themeRows[0]));
      await this.websiteData.saveFooterSettings(normalizeFooter(footerRows[0]));
      await this.websiteData.saveHeaderSettings(normalizeHeader(headerRows[0]));
      this.excelStatus.set('Settings imported successfully.');
    } catch (error) {
      console.error(error);
      this.excelStatus.set('Import failed. Ensure the Excel file contains valid settings sheets.');
    } finally {
      const inputElem = event.target as HTMLInputElement;
      if (inputElem) {
        inputElem.value = '';
      }
    }
  }

  private downloadBlob(data: ArrayBuffer, filename: string): void {
    const blob = new Blob([data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private parseBoolean(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return ['true', '1', 'yes'].includes(value.trim().toLowerCase());
    }
    return fallback;
  }

  private parseExcelJson<T>(value: unknown, fallback: T): T {
    if (Array.isArray(value) || typeof value === 'object') {
      return value as T;
    }
    if (typeof value === 'string' && value.trim()) {
      try {
        return JSON.parse(value) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }

  async seedDefaults(): Promise<void> {
    await this.runTask(
      () => this.websiteData.seedDefaultWebsite(),
      'Default menus, sections, theme, and footer saved.',
    );
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
      bgTransparency: Number(value.bgTransparency) !== undefined ? Number(value.bgTransparency) : 22,
      slides: this.editorSlides(),
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
