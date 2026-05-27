import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { WebsiteSection } from '../../core/models/website.models';

@Component({
  selector: 'app-dynamic-section',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dynamic-section.html',
  styleUrl: './dynamic-section.scss',
})
export class DynamicSectionComponent {
  @Input({ required: true }) section!: WebsiteSection;
  @Output() sectionAction = new EventEmitter<string>();

  readonly formStatus = signal('');
  readonly openFaq = signal(0);

  submitContact(): void {
    this.formStatus.set('Thanks. Your message has been captured for the DySi team.');
  }

  ratingArray(rating = 5): number[] {
    return Array.from({ length: Math.max(0, rating) });
  }

  sectionStyles(section: WebsiteSection): Record<string, string> {
    return {
      'background-color': section.backgroundColor || '',
      color: section.textColor || '',
      'font-family': section.fontFamily || '',
      'font-size': section.fontSize || '',
    };
  }
}
