import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
  OnInit,
  OnDestroy,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { WebsiteSection } from '../../core/models/website.models';
import { ImageValidatorService } from '../../core/services/image-validator.service';

@Component({
  selector: 'app-dynamic-section',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dynamic-section.html',
  styleUrl: './dynamic-section.scss',
})
export class DynamicSectionComponent implements OnInit, OnDestroy {
  @Input({ required: true }) section!: WebsiteSection;
  @Output() sectionAction = new EventEmitter<string>();

  readonly formStatus = signal('');
  readonly openFaq = signal(0);
  readonly isImageValid = signal(false);

  constructor(private readonly imageValidator: ImageValidatorService) {
    // Validate image whenever section changes
    effect(() => {
      if (this.section?.imageUrl) {
        this.validateSectionImage();
      } else {
        this.isImageValid.set(false);
      }
    });
  }

  ngOnInit(): void {
    if (this.section?.imageUrl) {
      this.validateSectionImage();
    }
  }

  ngOnDestroy(): void {
    // Cleanup is handled by the service
  }

  private validateSectionImage(): void {
    if (!this.section?.imageUrl) {
      this.isImageValid.set(false);
      return;
    }

    this.imageValidator
      .validateImageUrl(this.section.imageUrl)
      .then((isValid: boolean) => {
        this.isImageValid.set(isValid);
      })
      .catch(() => {
        this.isImageValid.set(false);
      });
  }

  submitContact(): void {
    this.formStatus.set('Thanks. Your message has been captured for the DySi team.');
  }

  ratingArray(rating = 5): number[] {
    return Array.from({ length: Math.max(0, rating) });
  }

  sectionStyles(section: WebsiteSection): Record<string, string> {
    const styles: Record<string, string> = {
      'background-color': section.backgroundColor || '',
      color: section.textColor || '',
      'font-family': section.fontFamily || '',
      'font-size': section.fontSize || '',
    };

    // Apply background image if valid
    if (this.isImageValid() && section.imageUrl) {
      styles['background-image'] = `url('${section.imageUrl}')`;
      styles['background-size'] = 'cover';
      styles['background-position'] = 'center';
      styles['background-repeat'] = 'no-repeat';
      styles['transition'] = 'background-image 0.3s ease-in-out, background-color 0.3s ease-in-out';
    } else {
      styles['transition'] = 'background-image 0.3s ease-in-out, background-color 0.3s ease-in-out';
    }

    return styles;
  }
}
