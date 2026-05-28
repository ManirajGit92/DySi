import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ImageValidatorService } from '../../core/services/image-validator.service';

interface FeedbackItem {
  name: string;
  company: string;
  text: string;
  image: string;
}

@Component({
  selector: 'app-feedback',
  imports: [CommonModule],
  templateUrl: './feedback.html',
  styleUrl: './feedback.scss',
})
export class FeedbackComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  readonly feedback = signal<FeedbackItem[]>([
    {
      name: 'Rhea Kapoor',
      company: 'BrightOps',
      text: 'DySi helped us replace a slow internal workflow with a polished portal our team enjoys using every day.',
      image:
        'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=300&q=80',
    },
    {
      name: 'Daniel Brooks',
      company: 'Northstar Labs',
      text: 'The launch was smooth, but the real win was how clearly they translated product strategy into engineering.',
      image:
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80',
    },
    {
      name: 'Priya Nair',
      company: 'ScaleBridge',
      text: 'Clean design, thoughtful delivery, and practical advice. They felt like an extension of our own team.',
      image:
        'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=300&q=80',
    },
  ]);

  readonly validImages = signal<Map<string, boolean>>(new Map());

  constructor(private readonly imageValidator: ImageValidatorService) {}

  ngOnInit(): void {
    this.validateAllImages();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private validateAllImages(): void {
    const validImages = new Map<string, boolean>();

    this.feedback().forEach((item) => {
      this.imageValidator
        .validateImageUrl(item.image)
        .then((isValid) => {
          validImages.set(item.image, isValid);
          this.validImages.set(new Map(validImages));
        })
        .catch(() => {
          validImages.set(item.image, false);
          this.validImages.set(new Map(validImages));
        });
    });
  }

  isImageValid(imageUrl: string): boolean {
    return this.validImages().get(imageUrl) ?? false;
  }

  getBackgroundStyle(imageUrl: string) {
    if (this.isImageValid(imageUrl)) {
      return {
        'background-image': `url('${imageUrl}')`,
      };
    }
    return {};
  }
}
