import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { WebsiteDataService } from '../../core/services/website-data.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './change-password.html',
  styleUrls: ['./change-password.scss']
})
export class ChangePasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly websiteData = inject(WebsiteDataService);
  private readonly router = inject(Router);

  isLoading = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  showCurrentPassword = signal(false);
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);

  form = this.fb.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmNewPassword: ['', [Validators.required]],
  });

  get currentPassword(): string {
    return this.form.controls.currentPassword.value || '';
  }

  get newPassword(): string {
    return this.form.controls.newPassword.value || '';
  }

  get confirmNewPassword(): string {
    return this.form.controls.confirmNewPassword.value || '';
  }

  // Password Requirement Checks
  get isAtLeast6Chars(): boolean {
    return this.newPassword.length >= 6;
  }

  get hasLettersAndNumbers(): boolean {
    const p = this.newPassword;
    return /[a-zA-Z]/.test(p) && /[0-9]/.test(p);
  }

  get isDifferentFromCurrent(): boolean {
    return Boolean(this.newPassword && this.currentPassword && this.newPassword !== this.currentPassword);
  }

  get isPasswordsMatching(): boolean {
    return Boolean(this.newPassword && this.confirmNewPassword && this.newPassword === this.confirmNewPassword);
  }

  async onSubmit(): Promise<void> {
    this.successMessage.set('');
    this.errorMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Please fill in all required password fields.');
      return;
    }

    if (!this.isAtLeast6Chars || !this.hasLettersAndNumbers || !this.isDifferentFromCurrent) {
      this.errorMessage.set('New password does not satisfy security requirements.');
      return;
    }

    if (!this.isPasswordsMatching) {
      this.errorMessage.set('New password and confirm password do not match.');
      return;
    }

    this.isLoading.set(true);

    try {
      await this.websiteData.changePassword(this.currentPassword, this.newPassword);
      this.isLoading.set(false);
      this.successMessage.set('Your password has been updated successfully!');
      this.form.reset();
      window.setTimeout(() => {
        void this.router.navigate(['/admin']);
      }, 1500);
    } catch (err: any) {
      this.isLoading.set(false);
      console.error('Password change error:', err);
      if (err.code === 'auth/wrong-password' || err.message?.includes('wrong-password') || err.message?.includes('invalid-credential')) {
        this.errorMessage.set('Current password entered is incorrect.');
      } else {
        this.errorMessage.set(err.message || 'Failed to update password. Please check your credentials.');
      }
    }
  }

  cancel(): void {
    void this.router.navigate(['/admin']);
  }
}
