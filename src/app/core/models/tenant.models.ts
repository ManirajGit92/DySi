import { Timestamp } from '@angular/fire/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  phone?: string;
  photoURL?: string;
  authProvider: 'google' | 'email';
  status: 'active' | 'inactive' | 'restricted';
  siteId?: string;
  createdAt?: Date | Timestamp | any;
  updatedAt?: Date | Timestamp | any;
  lastLogin?: Date | Timestamp | any;
}

export interface SiteConfig {
  id?: string;
  siteId: string;
  ownerUid: string;
  siteName: string;
  siteType: 'custom-domain' | 'subdomain';
  domain: string | null;
  subdomain: string | null;
  normalizedDomain: string | null;
  normalizedSubdomain: string | null;
  status: 'active' | 'inactive' | 'restricted' | 'pending';
  domainStatus?: 'PENDING' | 'VERIFYING' | 'ACTIVE' | 'FAILED';
  createdAt?: Date | Timestamp | any;
  updatedAt?: Date | Timestamp | any;
}
