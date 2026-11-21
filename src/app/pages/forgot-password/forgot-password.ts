import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WebsiteDataService } from '../../core/services/website-data.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.scss']
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly websiteData = inject(WebsiteDataService);

  isLoading = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  async onSubmit(): Promise<void> {
    this.successMessage.set('');
    this.errorMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Please enter a valid email address.');
      return;
    }

    const email = this.form.value.email || '';
    this.isLoading.set(true);

    try {
      await this.websiteData.sendPasswordReset(email);
      this.isLoading.set(false);
      this.successMessage.set(
        'Password reset link has been sent to your email address. Please check your inbox.'
      );
      this.form.reset();
    } catch (err: any) {
      this.isLoading.set(false);
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        // For security, don't expose user non-existence explicitly if desired, or show clean message
        this.successMessage.set(
          'If an account exists for that email, a password reset link has been sent.'
        );
      } else {
        this.errorMessage.set(err.message || 'Failed to send password reset email. Please try again.');
      }
    }
  }
}
