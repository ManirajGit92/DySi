import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { FirestoreService } from '../../core/services/firestore.service';
import { Product } from '../../core/models/product.models';

@Component({
  selector: 'app-services-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './services-page.html',
  styleUrls: ['./services-page.scss'],
})
export class ServicesPageComponent {
  products = signal<Product[]>([]);
  searchTerm = signal('');
  selectedCategory = signal('All');
  sortBy = signal('featured');
  minPrice = signal(0);
  maxPrice = signal(9999);
  currentPage = signal(1);
  pageSize = signal(8);
  selectedProduct = signal<Product | null>(null);
  viewMode = signal<'grid' | 'list'>('grid');
  paymentMessage = signal('');

  categories = computed(() => {
    const categories = new Set([
      'All',
      ...this.products().map((product) => product.category || 'Uncategorized'),
    ]);
    return Array.from(categories).sort();
  });

  filteredProducts = computed(() => {
    return this.products()
      .filter((product) => {
        const matchesSearch = [
          product.name,
          product.description,
          product.category,
          ...(product.tags || []),
        ]
          .join(' ')
          .toLowerCase()
          .includes(this.searchTerm().toLowerCase().trim());
        const matchesCategory =
          this.selectedCategory() === 'All' || product.category === this.selectedCategory();
        const matchesPrice = product.price >= this.minPrice() && product.price <= this.maxPrice();
        return matchesSearch && matchesCategory && matchesPrice;
      })
      .sort((left, right) => {
        switch (this.sortBy()) {
          case 'priceLow':
            return left.price - right.price;
          case 'priceHigh':
            return right.price - left.price;
          case 'rating':
            return (right.rating ?? 0) - (left.rating ?? 0);
          default:
            return (right.featured ? 1 : 0) - (left.featured ? 1 : 0);
        }
      });
  });

  paginatedProducts = computed(() => {
    const products = this.filteredProducts();
    const start = (this.currentPage() - 1) * this.pageSize();
    return products.slice(start, start + this.pageSize());
  });

  totalPages = computed(() => {
    return Math.max(1, Math.ceil(this.filteredProducts().length / this.pageSize()));
  });

  get cartItems() {
    return this.cart.cartItems;
  }

  constructor(
    private firestoreService: FirestoreService,
    public cart: CartService,
  ) {
    this.firestoreService.getProducts().subscribe((products) => {
      const normalized = products.map((product) => ({
        ...product,
        imageUrl:
          product.imageUrl ||
          'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80',
        rating: product.rating ?? 4.6,
        available: product.available ?? product.stock > 0,
        featured: product.featured ?? false,
        tags: product.tags ?? [],
      }));
      this.products.set(normalized);
    });
  }

  selectCategory(category: string): void {
    this.selectedCategory.set(category);
    this.currentPage.set(1);
  }

  setSort(option: string): void {
    this.sortBy.set(option);
    this.currentPage.set(1);
  }

  setPage(page: number): void {
    this.currentPage.set(Math.max(1, Math.min(page, this.totalPages())));
  }

  viewProduct(product: Product): void {
    this.selectedProduct.set(product);
  }

  closeProductDetails(): void {
    this.selectedProduct.set(null);
  }

  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode.set(mode);
  }

  addToCart(product: Product): void {
    if (!product.available || product.stock <= 0) {
      return;
    }
    this.cart.addToCart(product, 1);
    this.paymentMessage.set(`✔ Added ${product.name} to cart.`);
  }

  buyNow(product: Product): void {
    this.addToCart(product);
    this.paymentMessage.set(`Ready to checkout with ${product.name}.`);
  }

  checkout(): void {
    if (!this.cart.cartItems().length) {
      this.paymentMessage.set('Add an item to your cart before checkout.');
      return;
    }
    this.paymentMessage.set(
      'Payment integration UI ready. Use your preferred gateway to complete checkout.',
    );
  }

  updatePriceBounds(low: string, high: string): void {
    this.minPrice.set(Number(low) || 0);
    this.maxPrice.set(Number(high) || 9999);
    this.currentPage.set(1);
  }
}
