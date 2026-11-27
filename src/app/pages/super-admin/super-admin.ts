import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { WebsiteDataService } from '../../core/services/website-data.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-super-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './super-admin.html',
  styleUrls: ['./super-admin.scss']
})
export class SuperAdminComponent {
  private websiteData = inject(WebsiteDataService);
  private router = inject(Router);

  readonly user$ = this.websiteData.user$;
  readonly users = toSignal(this.websiteData.usersWithRoles$, { initialValue: [] });
  readonly logs = toSignal(this.websiteData.accessControlLogs$, { initialValue: [] });
  readonly adminsWithPermissions = toSignal(this.websiteData.adminsWithPermissions$, { initialValue: [] });

  readonly searchQuery = signal('');

  readonly sectionsMeta = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-table-cells-large' },
    { id: 'products', label: 'Products', icon: 'fa-cube' },
    { id: 'settings', label: 'Settings', icon: 'fa-gear' },
    { id: 'users', label: 'Users', icon: 'fa-users' },
    { id: 'analytics', label: 'Analytics', icon: 'fa-chart-line' },
    { id: 'bookings', label: 'Bookings', icon: 'fa-calendar-check' },
    { id: 'booking-settings', label: 'Booking Settings', icon: 'fa-sliders' }
  ];
  readonly filterRole = signal<'all' | 'admin' | 'super_admin' | 'restricted' | 'allowed'>('all');
  readonly logActionFilter = signal<string>('all');

  readonly logActionOptions = computed(() => {
    const actions = new Set(
      this.logs()
        .map((l: any) => l.action)
        .filter(Boolean),
    );
    return ['all', ...Array.from(actions)];
  });

  readonly filteredLogs = computed(() => {
    const action = this.logActionFilter();
    if (action === 'all') return this.logs();
    return this.logs().filter((l: any) => l.action === action);
  });
  
  readonly stats = computed(() => {
    const list = this.users();
    return {
      total: list.length,
      admins: list.filter(u => u.isAdmin).length,
      superAdmins: list.filter(u => u.isSuperAdmin).length,
      restricted: list.filter(u => u.isRestricted).length,
    };
  });

  readonly filteredUsers = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const roleFilter = this.filterRole();
    
    return this.users().filter(u => {
      const matchesSearch = 
        u.email?.toLowerCase().includes(query) || 
        u.displayName?.toLowerCase().includes(query);
        
      if (!matchesSearch) return false;
      
      switch (roleFilter) {
        case 'admin':
          return u.isAdmin;
        case 'super_admin':
          return u.isSuperAdmin;
        case 'restricted':
          return u.isRestricted;
        case 'allowed':
          return !u.isRestricted;
        default:
          return true;
      }
    });
  });

  isDarkTheme = false;

  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;
  }

  async toggleAdmin(user: any) {
    const currentUser = await firstValueFrom(this.user$);
    const performedBy = currentUser?.email || 'Unknown Super Admin';
    try {
      if (user.isAdmin) {
        await this.websiteData.removeAdmin(user.email, performedBy);
      } else {
        await this.websiteData.grantAdmin(user.email, performedBy);
      }
    } catch (error) {
      console.error('Failed to toggle admin access', error);
      alert('Action failed. Check console and security rules.');
    }
  }

  async toggleSuperAdmin(user: any) {
    if (user.email === 'manirajmca.ac@gmail.com') {
      alert('Cannot modify default super admin role.');
      return;
    }
    const currentUser = await firstValueFrom(this.user$);
    const performedBy = currentUser?.email || 'Unknown Super Admin';
    try {
      if (user.isSuperAdmin) {
        await this.websiteData.removeSuperAdmin(user.email, performedBy);
      } else {
        await this.websiteData.grantSuperAdmin(user.email, performedBy);
      }
    } catch (error) {
      console.error('Failed to toggle super admin access', error);
      alert('Action failed. Check console and security rules.');
    }
  }

  async toggleAccess(user: any) {
    const currentUser = await firstValueFrom(this.user$);
    const performedBy = currentUser?.email || 'Unknown Super Admin';
    try {
      if (user.isRestricted) {
        await this.websiteData.allowUser(user.email, performedBy);
      } else {
        await this.websiteData.restrictUser(user.email, performedBy);
      }
    } catch (error) {
      console.error('Failed to toggle user restriction', error);
      alert('Action failed. Check console and security rules.');
    }
  }

  async toggleSectionPermission(admin: any, sectionId: string) {
    const updatedSections = {
      ...admin.sections,
      [sectionId]: admin.sections[sectionId] === false ? true : false
    };
    const currentUser = await firstValueFrom(this.user$);
    const performedBy = currentUser?.email || 'Unknown Super Admin';
    try {
      await this.websiteData.updateAdminSectionPermission(admin.email, updatedSections, performedBy);
    } catch (error) {
      console.error('Failed to update admin section permission', error);
      alert('Action failed. Check console and security rules.');
    }
  }

  getInitial(name?: string | null, email?: string | null): string {
    const text = (name || email || 'U').trim();
    return text.charAt(0).toUpperCase();
  }

  exportUsersCsv(): void {
    const rows = [
      ['Name', 'Email', 'Provider', 'Admin', 'Super Admin', 'Restricted'],
      ...this.filteredUsers().map((u: any) => [
        u.displayName || 'No Name',
        u.email || '',
        u.providerId === 'google.com' ? 'Google' : 'Email',
        u.isAdmin ? 'Yes' : 'No',
        u.isSuperAdmin ? 'Yes' : 'No',
        u.isRestricted ? 'Restricted' : 'Active',
      ]),
    ];
    this.downloadCsv(rows, 'dysi-users-access.csv');
  }

  exportAuditLogCsv(): void {
    const rows = [
      ['Timestamp', 'Performed By', 'Action', 'Target Account'],
      ...this.filteredLogs().map((l: any) => [
        l.timestamp?.seconds ? new Date(l.timestamp.seconds * 1000).toISOString() : '',
        l.performedBy || '',
        l.action || '',
        l.email || '',
      ]),
    ];
    this.downloadCsv(rows, 'dysi-security-audit-log.csv');
  }

  private downloadCsv(rows: string[][], filename: string): void {
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async signOut() {
    await this.websiteData.signOut();
    void this.router.navigate(['/']);
  }
}
