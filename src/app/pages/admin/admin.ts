import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
import { FirestoreService } from '../../core/services/firestore.service';
import { Settings } from '../settings/settings';
import { BookingsAdminComponent } from './bookings-admin.component';
import { BookingSettingsComponent } from './booking-settings.component';
import { Product } from '../../core/models/product.models';
import { Router } from '@angular/router';
import { WebsiteDataService } from '../../core/services/website-data.service';
import { firstValueFrom, Subscription } from 'rxjs';

interface Order {
  id?: string;
  customer: string;
  product: string;
  total: number;
  status: 'Completed' | 'Pending' | 'Refunded' | 'Failed';
  date: string;
  items: number;
}

interface TrafficSource {
  source: string;
  percent: number;
  change: number;
}

import { FeedbackQuestionsMgrComponent } from './feedback-questions-mgr';
import { FeedbackAnalyticsDashboardComponent } from './feedback-analytics-dashboard';

interface CategoryPerformance {
  category: string;
  sold: number;
  revenue: number;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TabsModule,
    Settings,
    BookingsAdminComponent,
    BookingSettingsComponent,
    FeedbackQuestionsMgrComponent,
    FeedbackAnalyticsDashboardComponent
  ],
  templateUrl: './admin.html',
  styleUrls: ['./admin.scss'],
})
export class AdminComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly firestoreService = inject(FirestoreService);
  private readonly websiteData = inject(WebsiteDataService);

  activeTab: string = 'dashboard';
  private readonly subscriptions = new Subscription();

  readonly permissions = toSignal(this.websiteData.userSectionsPermission$, {
    initialValue: {
      dashboard: true,
      products: true,
      settings: true,
      users: true,
      analytics: true,
      bookings: true,
      'booking-settings': true
    } as Record<string, boolean>
  });
  isDarkTheme: boolean = false;
  products = signal<Product[]>([]);
  editing = signal(false);
  viewMode = signal<'grid' | 'list'>('grid');
  itemsPerRow = signal(4);
  searchQuery = signal('');
  selectedPeriod = signal<'Daily' | 'Weekly' | 'Monthly'>('Weekly');
  selectedStatus = signal<'All' | 'Completed' | 'Pending' | 'Refunded'>('All');
  orders = signal<Order[]>([]);
  trafficSources = signal<TrafficSource[]>([
    { source: 'Organic Search', percent: 43, change: 12 },
    { source: 'Paid Ads', percent: 21, change: 6 },
    { source: 'Social', percent: 18, change: -2 },
    { source: 'Referrals', percent: 12, change: 3 },
    { source: 'Email', percent: 6, change: 1 },
  ]);
  visitorTrend = signal([650, 720, 780, 880, 940, 1020, 1100]);
  salesTrend = signal([480, 520, 590, 650, 720, 820, 930]);
  categoriesPerformance = signal<CategoryPerformance[]>([
    { category: 'Design', sold: 1780, revenue: 38400 },
    { category: 'Software', sold: 1290, revenue: 51800 },
    { category: 'Marketing', sold: 940, revenue: 24750 },
    { category: 'Consulting', sold: 620, revenue: 19320 },
  ]);

  lowStocks = computed(() => this.products().filter((product) => product.stock < 12));

  totalSales = computed(() => this.orders().reduce((sum, order) => sum + order.total, 0));
  totalOrders = computed(() => this.orders().length);
  totalCustomers = computed(() => new Set(this.orders().map((order) => order.customer)).size);
  productsSold = computed(() => this.orders().reduce((sum, order) => sum + order.items, 0));
  conversionRate = computed(() => {
    const total = this.orders().length;
    if (!total) return 4.9;
    const completed = this.orderStatuses().completed;
    return Math.max(2, Math.min(12, Math.round(((completed / total) * 100) / 3)));
  });
  checkoutRate = computed(() => {
    const total = this.orders().length;
    if (!total) return 68;
    const completed = this.orderStatuses().completed;
    return Math.max(35, Math.min(98, Math.round(50 + (completed / total) * 50)));
  });
  paymentSuccess = computed(() => {
    const total = this.orders().length;
    if (!total) return 92;
    const completed = this.orderStatuses().completed;
    return Math.round((completed / total) * 100);
  });

  orderStatuses = computed(() => ({
    completed: this.orders().filter((order) => order.status === 'Completed').length,
    pending: this.orders().filter((order) => order.status === 'Pending').length,
    refunded: this.orders().filter((order) => order.status === 'Refunded').length,
  }));

  revenueMetric = signal<'Revenue' | 'Orders' | 'Profit'>('Revenue');
  activeChartIndex = signal(4);

  orderStatusPercents = computed(() => {
    const total = this.orders().length;
    if (!total) {
      return { completed: 77, pending: 20, refunded: 3 };
    }
    const s = this.orderStatuses();
    return {
      completed: Math.round((s.completed / total) * 100),
      pending: Math.round((s.pending / total) * 100),
      refunded: Math.round((s.refunded / total) * 100),
    };
  });

  totalVisits = computed(() => this.visitorTrend().reduce((sum, v) => sum + v, 0));

  revenueChartPoints = computed(() => {
    const metric = this.revenueMetric();
    const period = this.selectedPeriod();
    const multiplier = period === 'Daily' ? 0.35 : period === 'Monthly' ? 3.2 : 1;
    const labels =
      period === 'Daily'
        ? ['9 AM', '11 AM', '1 PM', '3 PM', '5 PM', '7 PM', '9 PM']
        : period === 'Monthly'
          ? ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']
          : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const sales = this.salesTrend();
    const visitors = this.visitorTrend();

    const rawValues = sales.map((val, i) => {
      if (metric === 'Orders') return Math.round((visitors[i] ?? val) * 0.85 * multiplier);
      if (metric === 'Profit') return Math.round(val * 0.42 * 22 * multiplier);
      return Math.round(val * 24 * multiplier);
    });
    const maxVal = Math.max(...rawValues, 1);

    return labels.map((label, idx) => {
      const value = rawValues[idx] ?? 0;
      const orderCount = Math.round((visitors[idx] ?? 500) * 0.85 * multiplier);
      const heightPct = Math.max(18, Math.round((value / maxVal) * 86));
      return {
        label,
        value,
        orderCount,
        heightPct,
        lineBottomPct: Math.min(92, Math.max(22, heightPct + 8)),
      };
    });
  });

  revenueLinePolyline = computed(() => {
    const pts = this.revenueChartPoints();
    if (!pts.length) return '';
    return pts
      .map((p, idx) => {
        const x = ((idx + 0.5) / pts.length) * 100;
        const y = 100 - p.lineBottomPct;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });

  topProducts = computed(() => {
    const counts = this.orders().reduce(
      (map, order) => {
        map[order.product] = (map[order.product] || 0) + order.items;
        return map;
      },
      {} as Record<string, number>,
    );

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([product, sold], index) => ({
        product,
        sold,
        revenue: sold * 220 + index * 40,
      }));
  });

  filteredOrders = computed(() => {
    const search = this.searchQuery().toLowerCase().trim();
    return this.orders().filter((order) => {
      const matchesSearch = [order.id, order.customer, order.product, order.status]
        .join(' ')
        .toLowerCase()
        .includes(search);
      const matchesStatus =
        this.selectedStatus() === 'All' || order.status === this.selectedStatus();
      return matchesSearch && matchesStatus;
    });
  });

  productStatus = computed(() => ({
    total: this.products().length,
    inStock: this.products().filter((product) => product.available).length,
    outOfStock: this.products().filter((product) => !product.available).length,
    lowStock: this.lowStocks().length,
  }));

  productSearchQuery = signal('');
  selectedProductCategory = signal('All');
  productsPerPage = signal(8);
  currentProductPage = signal(1);
  productUploadStatus = signal('');

  productCategories = computed(() => {
    const cats = new Set(
      this.products()
        .map((p) => (p.category || 'General').trim())
        .filter(Boolean),
    );
    return ['All', ...Array.from(cats).sort()];
  });

  averageProductRating = computed(() => {
    const list = this.products();
    if (!list.length) return '0.0';
    const sum = list.reduce((acc, p) => acc + (p.rating ?? 4.5), 0);
    return (sum / list.length).toFixed(1);
  });

  filteredProducts = computed(() => {
    const q = this.productSearchQuery().toLowerCase().trim();
    const cat = this.selectedProductCategory();
    return this.products().filter((p) => {
      const matchesCat = cat === 'All' || (p.category || 'General') === cat;
      const matchesQuery =
        !q ||
        [p.name, p.category, p.description, ...(p.tags || [])]
          .join(' ')
          .toLowerCase()
          .includes(q);
      return matchesCat && matchesQuery;
    });
  });

  totalProductPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredProducts().length / this.productsPerPage())),
  );

  productPageNumbers = computed(() =>
    Array.from({ length: this.totalProductPages() }, (_, i) => i + 1),
  );

  paginatedProducts = computed(() => {
    const page = Math.min(this.currentProductPage(), this.totalProductPages());
    const perPage = this.productsPerPage();
    const start = (page - 1) * perPage;
    return this.filteredProducts().slice(start, start + perPage);
  });

  productPageStart = computed(() => {
    if (!this.filteredProducts().length) return 0;
    const page = Math.min(this.currentProductPage(), this.totalProductPages());
    return (page - 1) * this.productsPerPage() + 1;
  });

  productPageEnd = computed(() => {
    const total = this.filteredProducts().length;
    if (!total) return 0;
    const page = Math.min(this.currentProductPage(), this.totalProductPages());
    return Math.min(page * this.productsPerPage(), total);
  });

  // Injected services moved to the top of the class

  readonly user$ = this.websiteData.user$;
  readonly isAdmin$ = this.websiteData.isAdmin$;
  readonly isSuperAdmin$ = this.websiteData.isSuperAdmin$;

  readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  readonly loginStatus = signal('');

  productForm = this.fb.group({
    id: [null as string | null],
    name: ['', Validators.required],
    category: ['General', Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    available: [true],
    featured: [false],
    rating: [4.6, [Validators.min(0), Validators.max(5)]],
    imageUrl: [''],
    description: ['', Validators.required],
    tags: [''],
  });

  productPreview = computed(() => this.productForm.value as Product);

  constructor(private router: Router) {
    this.firestoreService.getProducts().subscribe((products) => this.products.set(products));
    this.firestoreService.getOrders().subscribe((orders) => this.orders.set(orders));

    this.subscriptions.add(
      this.websiteData.userSectionsPermission$.subscribe((perms) => {
        if (perms && perms[this.activeTab] === false) {
          const allowedTab = Object.entries(perms).find(([_, allowed]) => allowed)?.[0];
          if (allowedTab) {
            this.activeTab = allowedTab;
          }
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  async signInWithGoogle(): Promise<void> {
    this.loginStatus.set('Signing in...');
    try {
      await this.websiteData.signInWithGoogle();
      this.loginStatus.set('Signed in successfully.');
      await this.checkRoleAndRedirect();
    } catch (err) {
      console.error(err);
      this.loginStatus.set('Google sign-in failed.');
    }
  }

  async signInWithEmail(): Promise<void> {
    if (this.loginForm.invalid) return;
    const { email, password } = this.loginForm.value;
    this.loginStatus.set('Signing in...');
    try {
      await this.websiteData.signInWithEmail(email!, password!);
      this.loginStatus.set('Signed in successfully.');
      await this.checkRoleAndRedirect();
    } catch (err) {
      console.error(err);
      this.loginStatus.set('Email sign-in failed.');
    }
  }

  async registerWithEmail(): Promise<void> {
    if (this.loginForm.invalid) return;
    const { email, password } = this.loginForm.value;
    this.loginStatus.set('Registering...');
    try {
      await this.websiteData.registerWithEmail(email!, password!);
      this.loginStatus.set('Account created successfully.');
      await this.checkRoleAndRedirect();
    } catch (err) {
      console.error(err);
      this.loginStatus.set('Registration failed. Email might already exist.');
    }
  }

  private async checkRoleAndRedirect(): Promise<void> {
    try {
      const isSuper = await firstValueFrom(this.websiteData.isSuperAdmin$);
      if (isSuper) {
        void this.router.navigate(['/super-admin']);
        return;
      }
      const isAdmin = await firstValueFrom(this.websiteData.isAdmin$);
      if (isAdmin) {
        return;
      }
      void this.router.navigate(['/']);
    } catch (error) {
      console.error('Error checking role after login', error);
      void this.router.navigate(['/']);
    }
  }

  async signOut(): Promise<void> {
    await this.websiteData.signOut();
    this.loginStatus.set('Signed out.');
  }

  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;
  }

  getUserInitial(user: { displayName?: string | null; email?: string | null } | null): string {
    const label = (user?.displayName || user?.email || 'A').trim();
    return label.charAt(0).toUpperCase();
  }

  getFirstName(user: { displayName?: string | null; email?: string | null } | null): string {
    if (user?.displayName) {
      return user.displayName.split(' ')[0];
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'Admin';
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  getCustomerInitial(name: string): string {
    return (name || 'C').trim().charAt(0).toUpperCase();
  }

  getProductImage(productName: string): string {
    const match = this.products().find(
      (p) => p.name.toLowerCase() === productName.toLowerCase(),
    );
    return match?.imageUrl || '';
  }

  setRevenueMetric(metric: 'Revenue' | 'Orders' | 'Profit'): void {
    this.revenueMetric.set(metric);
  }

  openAddProduct(): void {
    this.createProduct();
    this.selectTab('products');
  }

  exportDashboardReport(): void {
    const rows = [
      ['Order ID', 'Customer', 'Product', 'Items', 'Status', 'Total', 'Date'],
      ...this.filteredOrders().map((o) => [
        o.id || '',
        o.customer,
        o.product,
        String(o.items),
        o.status,
        o.total.toFixed(2),
        o.date,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dysi-dashboard-report-${this.selectedPeriod().toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  toggleAndNavigate() {
    this.toggleTheme();             // 1. Toggle the theme
    this.router.navigate(['/']);    // 2. Navigate to the homepage
  }

  selectTab(tab: string): void {
    this.activeTab = tab;
  }

  setPeriod(period: 'Daily' | 'Weekly' | 'Monthly'): void {
    this.selectedPeriod.set(period);
  }

  setStatus(status: 'All' | 'Completed' | 'Pending' | 'Refunded'): void {
    this.selectedStatus.set(status);
  }

  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode.set(mode);
  }

  setItemsPerRow(count: number): void {
    this.itemsPerRow.set(count);
  }

  updateSearchQuery(value: string): void {
    this.searchQuery.set(value);
  }

  updateStatus(value: string): void {
    this.setStatus(value as 'All' | 'Completed' | 'Pending' | 'Refunded');
  }

  updateProductSearch(value: string): void {
    this.productSearchQuery.set(value);
    this.currentProductPage.set(1);
  }

  updateProductCategory(value: string): void {
    this.selectedProductCategory.set(value);
    this.currentProductPage.set(1);
  }

  updateProductsPerPage(value: number): void {
    this.productsPerPage.set(Number(value) || 8);
    this.currentProductPage.set(1);
  }

  setProductPage(page: number): void {
    const clamped = Math.max(1, Math.min(page, this.totalProductPages()));
    this.currentProductPage.set(clamped);
  }

  resetProductFilters(): void {
    this.productSearchQuery.set('');
    this.selectedProductCategory.set('All');
    this.currentProductPage.set(1);
  }

  formatProductCode(index: number): string {
    const num = this.productPageStart() + index;
    return `#P${String(num).padStart(3, '0')}`;
  }

  async uploadProductImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.productUploadStatus.set('Uploading image...');
    try {
      const url = await this.websiteData.uploadImage(file);
      this.productForm.patchValue({ imageUrl: url });
      this.productUploadStatus.set('Image uploaded successfully.');
    } catch (err) {
      console.error(err);
      this.productUploadStatus.set('Upload failed. You can also paste an Image URL.');
    } finally {
      input.value = '';
    }
  }

  createProduct(): void {
    this.editing.set(false);
    this.productUploadStatus.set('');
    this.productForm.reset({
      id: null,
      name: '',
      category: 'General',
      price: 0,
      stock: 0,
      available: true,
      featured: false,
      rating: 4.6,
      imageUrl: '',
      description: '',
      tags: '',
    });
  }

  editProduct(product: Product): void {
    this.editing.set(true);
    this.productUploadStatus.set('');
    this.productForm.setValue({
      id: product.id ?? null,
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock,
      available: product.available,
      featured: product.featured ?? false,
      rating: product.rating ?? 4.6,
      imageUrl: product.imageUrl,
      description: product.description,
      tags: (product.tags || []).join(', '),
    });
    this.activeTab = 'products';
  }

  async saveProduct(): Promise<void> {
    if (this.productForm.invalid) {
      return;
    }

    const model: Product = {
      ...this.productForm.value,
      tags: (this.productForm.value.tags as string)
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    } as Product;

    try {
      if (this.editing()) {
        await this.firestoreService.updateProduct(model);
      } else {
        await this.firestoreService.addProduct(model);
      }
      this.createProduct();
    } catch (error) {
      console.error('Unable to save product', error);
    }
  }

  async removeProduct(product: Product): Promise<void> {
    if (!product.id) {
      return;
    }
    await this.firestoreService.deleteProduct(product.id);
  }
}
