import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';

type NavItem = {
  id: string;
  label: string;
};

@Component({
  selector: 'app-header',
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class HeaderComponent {
  @Input() activeSection = 'home';
  @Input() isDarkTheme = false;
  @Output() sectionSelected = new EventEmitter<string>();
  @Output() themeToggled = new EventEmitter<void>();

  readonly isMenuOpen = signal(false);
  readonly navItems: NavItem[] = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About Us' },
    { id: 'services', label: 'Services' },
    { id: 'team', label: 'Team' },
    { id: 'feedback', label: 'Feedback' },
    { id: 'contact', label: 'Contact Us' },
  ];

  selectSection(sectionId: string): void {
    this.sectionSelected.emit(sectionId);
    this.isMenuOpen.set(false);
  }
}
