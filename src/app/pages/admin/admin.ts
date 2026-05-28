import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
import { FirestoreService } from '../../core/services/firestore.service';
import { Settings } from '../settings/settings';
import { Product } from '../../core/models/product.models';

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

interface CategoryPerformance {
  category: string;
  sold: number;
  revenue: number;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TabsModule, Settings],
  templateUrl: './admin.html',
  styleUrls: ['./admin.scss'],
})
export class AdminComponent {
  activeTab: string = 'dashboard';
  isDarkTheme: boolean = true;
  products = signal<Product[]>([]);
  editing = signal(false);
  viewMode = signal<'grid' | 'list'>('grid');
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

  private fb = inject(FormBuilder);
  private firestoreService = inject(FirestoreService);

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

  constructor() {
    this.firestoreService.getProducts().subscribe((products) => this.products.set(products));
    this.firestoreService.getOrders().subscribe((orders) => this.orders.set(orders));
  }

  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;
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

  updateSearchQuery(value: string): void {
    this.searchQuery.set(value);
  }

  updateStatus(value: string): void {
    this.setStatus(value as 'All' | 'Completed' | 'Pending' | 'Refunded');
  }

  createProduct(): void {
    this.editing.set(false);
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
    this.activeTab = 'dashboard';
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
