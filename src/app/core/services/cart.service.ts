import { Injectable, computed, effect, signal, WritableSignal } from '@angular/core';
import { CartItem, Product } from '../models/product.models';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private readonly storageKey = 'dySiCart';
  cartItems: WritableSignal<CartItem[]> = signal([]);

  cartCount = computed(() => this.cartItems().reduce((sum, item) => sum + item.quantity, 0));
  cartSubtotal = computed(() =>
    this.cartItems().reduce((sum, item) => sum + item.quantity * item.product.price, 0),
  );

  constructor() {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      try {
        this.cartItems.set(JSON.parse(stored));
      } catch {
        this.cartItems.set([]);
      }
    }

    effect(() => {
      localStorage.setItem(this.storageKey, JSON.stringify(this.cartItems()));
    });
  }

  addToCart(product: Product, quantity = 1): void {
    const items = [...this.cartItems()];
    const existing = items.find((item) => item.product.id === product.id);

    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, product.stock);
    } else {
      items.push({ product, quantity: Math.min(quantity, product.stock) });
    }

    this.cartItems.set(items);
  }

  updateQuantity(productId: string | undefined, quantity: number): void {
    if (!productId) {
      return;
    }

    const nextItems = this.cartItems().reduce<CartItem[]>((result, item) => {
      if (item.product.id === productId) {
        const nextQuantity = Math.max(0, Math.min(quantity, item.product.stock));
        if (nextQuantity > 0) {
          result.push({ ...item, quantity: nextQuantity });
        }
      } else {
        result.push(item);
      }
      return result;
    }, []);

    this.cartItems.set(nextItems);
  }

  removeItem(productId: string | undefined): void {
    if (!productId) {
      return;
    }

    this.cartItems.set(this.cartItems().filter((item) => item.product.id !== productId));
  }

  clearCart(): void {
    this.cartItems.set([]);
  }
}
