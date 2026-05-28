import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
import { FirestoreService } from '../../core/services/firestore.service';
import { Settings } from '../settings/settings';
import { Product } from '../../core/models/product.models';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TabsModule, Settings],
  templateUrl: './admin.html',
  styleUrls: ['./admin.scss'],
})
export class AdminComponent {
  activeTab: string = 'dashboard';
  isDarkTheme: boolean = true;
  products = signal<Product[]>([]);
  editing = signal(false);
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
  }

  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;
  }

  selectTab(tab: string): void {
    this.activeTab = tab;
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
