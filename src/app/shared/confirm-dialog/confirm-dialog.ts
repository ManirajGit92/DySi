import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dialog-backdrop" *ngIf="isOpen" (click)="onBackdropClick($event)">
      <div class="dialog-card" role="alertdialog" aria-modal="true" [attr.aria-labelledby]="'dialog-title'" [attr.aria-describedby]="'dialog-desc'">
        <!-- Warning Icon -->
        <div class="dialog-icon" [ngClass]="iconClass">
          <i [class]="icon"></i>
        </div>

        <!-- Content -->
        <div class="dialog-body">
          <h3 class="dialog-title" id="dialog-title">{{ title }}</h3>
          <p class="dialog-message" id="dialog-desc">{{ message }}</p>
          <p class="dialog-sub" *ngIf="subMessage">{{ subMessage }}</p>
        </div>

        <!-- Actions -->
        <div class="dialog-actions">
          <button class="dialog-btn dialog-btn--cancel" type="button" (click)="onCancel()">
            <i class="fa-solid fa-xmark mr-1"></i> {{ cancelLabel }}
          </button>
          <button class="dialog-btn dialog-btn--confirm" type="button" [disabled]="isProcessing" (click)="onConfirm()">
            <i *ngIf="!isProcessing" [class]="confirmIcon + ' mr-1'"></i>
            <i *ngIf="isProcessing" class="fa-solid fa-spinner fa-spin mr-1"></i>
            {{ isProcessing ? 'Processing...' : confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      animation: backdropIn 0.2s ease;
    }

    @keyframes backdropIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .dialog-card {
      background: var(--admin-surface, #1e2535);
      border: 1px solid var(--admin-border, rgba(255,255,255,0.08));
      border-radius: 20px;
      padding: 2rem;
      width: min(440px, calc(100vw - 2rem));
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.25rem;
      text-align: center;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
      animation: cardIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes cardIn {
      from { opacity: 0; transform: scale(0.88) translateY(16px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }

    .dialog-icon {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.8rem;
      flex-shrink: 0;

      &.danger  { background: rgba(239, 68, 68, 0.12);  color: #ef4444; border: 2px solid rgba(239, 68, 68, 0.25); }
      &.warning { background: rgba(245, 158, 11, 0.12); color: #f59e0b; border: 2px solid rgba(245, 158, 11, 0.25); }
      &.info    { background: rgba(37, 99, 235, 0.12);  color: #3b82f6; border: 2px solid rgba(37, 99, 235, 0.25); }
    }

    .dialog-body {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .dialog-title {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 800;
      color: var(--admin-text, #f1f5f9);
    }

    .dialog-message {
      margin: 0;
      font-size: 0.95rem;
      color: var(--admin-muted, #94a3b8);
      line-height: 1.6;
    }

    .dialog-sub {
      margin: 0;
      font-size: 0.82rem;
      color: #ef4444;
      font-weight: 700;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.15);
    }

    .dialog-actions {
      display: flex;
      gap: 0.75rem;
      width: 100%;
      padding-top: 0.5rem;
      border-top: 1px solid var(--admin-border, rgba(255,255,255,0.08));
    }

    .dialog-btn {
      flex: 1;
      min-height: 2.6rem;
      border-radius: 10px;
      border: none;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      transition: all 0.2s ease;

      &--cancel {
        background: var(--admin-surface, #1e2535);
        border: 1px solid var(--admin-border, rgba(255,255,255,0.08));
        color: var(--admin-muted, #94a3b8);
        &:hover { border-color: var(--admin-text, #f1f5f9); color: var(--admin-text, #f1f5f9); }
      }

      &--confirm {
        background: #ef4444;
        color: #fff;
        &:hover:not([disabled]) { background: #dc2626; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(239, 68, 68, 0.35); }
        &[disabled] { opacity: 0.6; cursor: not-allowed; }
      }
    }
  `]
})
export class ConfirmDialogComponent {
  @Input() isOpen = false;
  @Input() title = 'Are you sure?';
  @Input() message = 'This action cannot be undone.';
  @Input() subMessage = '';
  @Input() cancelLabel = 'Cancel';
  @Input() confirmLabel = 'Confirm';
  @Input() icon = 'fa-solid fa-triangle-exclamation';
  @Input() confirmIcon = 'fa-solid fa-trash';
  @Input() variant: 'danger' | 'warning' | 'info' = 'danger';
  @Input() isProcessing = false;

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  get iconClass(): string {
    return this.variant;
  }

  onConfirm(): void {
    this.confirmed.emit();
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('dialog-backdrop')) {
      this.cancelled.emit();
    }
  }
}
