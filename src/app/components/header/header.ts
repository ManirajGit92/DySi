import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MenuItem } from '../../core/models/website.models';

@Component({
  selector: 'app-header',
  imports: [CommonModule, RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class HeaderComponent {
  @Input() activeSection = 'home';
  @Input() isDarkTheme = false;
  @Input() menus: MenuItem[] = [];
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
