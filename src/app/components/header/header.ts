import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { HeaderSettings, MenuItem } from '../../core/models/website.models';
import { WebsiteDataService } from '../../core/services/website-data.service';

@Component({
  standalone: true,
  selector: 'app-header',
  imports: [CommonModule, RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class HeaderComponent {
  readonly websiteData = inject(WebsiteDataService);
  readonly user$ = this.websiteData.user$;

  @Input() activeSection = 'home';
  @Input() isDarkTheme = false;
  @Input() showTopNavMenu = true;
  @Input() menus: MenuItem[] = [];
  @Input() headerSettings: HeaderSettings | null = null;
  @Input() isAdmin = false;
  @Input() isSuperAdmin = false;
  @Output() sectionSelected = new EventEmitter<string>();
  @Output() themeToggled = new EventEmitter<void>();

  readonly isMenuOpen = signal(false);
  readonly isSearchOpen = signal(false);
  readonly searchTerm = signal('');

  selectSection(sectionId: string): void {
    this.sectionSelected.emit(sectionId);
    this.isMenuOpen.set(false);
    this.isSearchOpen.set(false);
  }

  filteredMenus(): MenuItem[] {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) {
      return this.menus;
    }
    return this.menus.filter((item) => item.title.toLowerCase().includes(term));
  }
}
