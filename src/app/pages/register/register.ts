import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { WebsiteDataService } from '../../core/services/website-data.service';
import { TenantResolverService } from '../../core/services/tenant-resolver.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrls: ['./register.scss']
})
export class RegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly websiteData = inject(WebsiteDataService);
  private readonly tenantResolver = inject(TenantResolverService);
  private readonly router = inject(Router);

  currentStep = signal<1 | 2 | 3>(1);
  isLoading = signal(false);
  errorMessage = signal('');
  availabilityMessage = signal('');
  isCheckingAvailability = signal(false);
  isIdentifierAvailable = signal(false);

  // Pre-filled Google auth user if available
  googleUserUid: string | null = null;
  googleUserEmail: string | null = null;
  googleUserName: string | null = null;

  accountForm = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9+()\s-]{7,20}$/)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
    showPassword: [false],
    showConfirmPassword: [false],
  });

  websiteForm = this.fb.group({
    websiteName: ['', [Validators.required, Validators.minLength(2)]],
    siteType: ['subdomain' as 'subdomain' | 'custom-domain', [Validators.required]],
    identifier: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.websiteData.user$.subscribe((user) => {
      if (user) {
        this.googleUserUid = user.uid;
        this.googleUserEmail = user.email || '';
        this.googleUserName = user.displayName || '';

        // Pre-fill account form if user logged in via Google but hasn't completed site setup
        if (this.googleUserEmail) {
          this.accountForm.patchValue({
            email: this.googleUserEmail,
            fullName: this.googleUserName || this.googleUserEmail.split('@')[0],
            password: 'OAUTH_GOOGLE_USER_NO_PASSWORD',
            confirmPassword: 'OAUTH_GOOGLE_USER_NO_PASSWORD',
          });
          // Password not required for Google users
          this.accountForm.controls.password.clearValidators();
          this.accountForm.controls.confirmPassword.clearValidators();
          this.accountForm.controls.password.updateValueAndValidity();
          this.accountForm.controls.confirmPassword.updateValueAndValidity();
        }

        // Check if user already has a site
        this.websiteData.getUserSite(user.uid).then((site) => {
          if (site) {
            void this.router.navigate(['/admin']);
          }
        });
      }
    });

    // Auto-normalize identifier input on change
    this.websiteForm.controls.identifier.valueChanges.subscribe((val) => {
      if (val) {
        this.checkIdentifier(val);
      } else {
        this.availabilityMessage.set('');
        this.isIdentifierAvailable.set(false);
      }
    });

    // Reset validation when site type changes
    this.websiteForm.controls.siteType.valueChanges.subscribe(() => {
      const val = this.websiteForm.controls.identifier.value;
      if (val) {
        this.checkIdentifier(val);
      }
    });
  }

  get isGoogleAuth(): boolean {
    return !!this.googleUserUid;
  }

  get siteType(): 'subdomain' | 'custom-domain' {
    return this.websiteForm.controls.siteType.value || 'subdomain';
  }

  get publicUrlPreview(): string {
    const raw = this.websiteForm.controls.identifier.value || '';
    if (this.siteType === 'subdomain') {
      const norm = this.tenantResolver.normalizeSubdomain(raw);
      return norm ? `https://dysi.web.app/${norm}` : 'https://dysi.web.app/your-site';
    } else {
      const norm = this.tenantResolver.normalizeDomain(raw);
      return norm ? `https://${norm}` : 'https://your-domain.com';
    }
  }

  async checkIdentifier(raw: string): Promise<void> {
    if (!raw.trim()) {
      this.availabilityMessage.set('');
      this.isIdentifierAvailable.set(false);
      return;
    }

    this.isCheckingAvailability.set(true);
    this.availabilityMessage.set('Checking availability...');

    try {
      const res = await this.tenantResolver.checkIdentifierAvailable(raw, this.siteType);
      this.isCheckingAvailability.set(false);
      if (res.available) {
        this.isIdentifierAvailable.set(true);
        this.availabilityMessage.set(
          this.siteType === 'subdomain'
            ? '✓ Subdomain is available!'
            : '✓ Domain is available for configuration!'
        );
      } else {
        this.isIdentifierAvailable.set(false);
        this.availabilityMessage.set(`✕ ${res.reason}`);
      }
    } catch {
      this.isCheckingAvailability.set(false);
      this.isIdentifierAvailable.set(false);
      this.availabilityMessage.set('Unable to verify availability.');
    }
  }

  nextToStep2(): void {
    this.errorMessage.set('');
    if (!this.isGoogleAuth) {
      if (this.accountForm.invalid) {
        this.accountForm.markAllAsTouched();
        this.errorMessage.set('Please fill in all required account fields correctly.');
        return;
      }
      if (this.accountForm.value.password !== this.accountForm.value.confirmPassword) {
        this.errorMessage.set('Password and Confirm Password do not match.');
        return;
      }
    } else {
      if (
        !this.accountForm.value.fullName ||
        !this.accountForm.value.email ||
        !this.accountForm.value.phone
      ) {
        this.errorMessage.set('Please fill in your contact details.');
        return;
      }
    }
    this.currentStep.set(2);
  }

  nextToStep3(): void {
    this.errorMessage.set('');
    if (this.websiteForm.invalid) {
      this.websiteForm.markAllAsTouched();
      this.errorMessage.set('Please fill in website information.');
      return;
    }
    if (!this.isIdentifierAvailable()) {
      this.errorMessage.set('Please choose a valid and available domain or subdomain.');
      return;
    }
    this.currentStep.set(3);
  }

  goToStep(step: 1 | 2 | 3): void {
    if (step === 2 && this.currentStep() === 1) {
      this.nextToStep2();
      return;
    }
    if (step === 3) {
      if (this.currentStep() === 1) {
        this.nextToStep2();
        if (this.currentStep() === 2) this.nextToStep3();
      } else if (this.currentStep() === 2) {
        this.nextToStep3();
      }
      return;
    }
    this.currentStep.set(step);
  }

  async completeRegistration(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      let uid = this.googleUserUid;
      let email = this.accountForm.value.email || '';
      const fullName = this.accountForm.value.fullName || '';
      const phone = this.accountForm.value.phone || '';
      const websiteName = this.websiteForm.value.websiteName || '';
      const rawIdentifier = this.websiteForm.value.identifier || '';

      // 1. Create Firebase Auth user if email/password registration
      if (!uid) {
        const password = this.accountForm.value.password || '';
        const userCred: any = await this.websiteData.registerWithEmail(email, password);
        uid = userCred.user.uid;
      }

      if (!uid) {
        throw new Error('Authentication failed. Could not retrieve user identity.');
      }

      // 2. Register tenant site & profile in Firestore
      const siteType = this.siteType;
      const subdomain =
        siteType === 'subdomain'
          ? this.tenantResolver.normalizeSubdomain(rawIdentifier)
          : null;
      const domain =
        siteType === 'custom-domain'
          ? this.tenantResolver.normalizeDomain(rawIdentifier)
          : null;

      await this.websiteData.registerTenantAndSite({
        uid,
        email,
        displayName: fullName,
        phone,
        authProvider: this.isGoogleAuth ? 'google' : 'email',
        siteName: websiteName,
        siteType,
        domain,
        subdomain,
      });

      // 3. Redirect to Admin Dashboard
      this.isLoading.set(false);
      void this.router.navigate(['/admin']);
    } catch (err: any) {
      this.isLoading.set(false);
      console.error('Registration failed:', err);
      this.errorMessage.set(
        err.message || 'Registration failed. Email or domain may already be in use.'
      );
    }
  }
}
