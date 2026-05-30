import { Timestamp } from '@angular/fire/firestore';

export type LayoutType =
  | 'hero'
  | 'about'
  | 'services'
  | 'team'
  | 'testimonials'
  | 'contact'
  | 'faq'
  | 'gallery'
  | 'default';

export interface MenuItem {
  id?: string;
  title: string;
  routeKey: string;
  order: number;
  isVisible: boolean;
  sectionId: string;
}

export interface WebsiteSection {
  id?: string;
  sectionId: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  buttonText: string;
  buttonLink: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  fontSize: string;
  layoutType: LayoutType;
  isDarkSection: boolean;
  isVisible: boolean;
  order: number;
  cards: ContentCard[];
  faqs: FaqItem[];
  gallery: string[];
  createdDate?: Date | Timestamp;
  updatedDate?: Date | Timestamp;
}

export interface ContentCard {
  icon: string;
  title: string;
  description: string;
  imageUrl?: string;
  meta?: string;
  rating?: number;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ThemeSettings {
  id?: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  buttonColor: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  letterSpacing: string;
  lineHeight: string;
  sectionSpacing: string;
  borderRadius: string;
  cardShadow: string;
  containerWidth: string;
  showHeader: boolean;
  showTopNavMenu: boolean;
  themeMode: 'light' | 'dark' | 'auto';
}

export interface FooterSettings {
  id?: string;
  description: string;
  importantLinks: FooterLink[];
  socialLinks: FooterLink[];
  copyright: string;
}

export interface FooterLink {
  label: string;
  url: string;
  icon?: string;
}

export interface HeaderSettings {
  id?: string;
  logoUrl: string;
  websiteName: string;
  logoAlt?: string;
  logoWidth?: string;
  logoHeight?: string;
}
