import { Injectable, inject } from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  Firestore,
  serverTimestamp,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Product } from '../models/product.models';

interface FirestoreOrder {
  id?: string;
  customer: string;
  product: string;
  total: number;
  status: 'Completed' | 'Pending' | 'Refunded' | 'Failed';
  date: string;
  items: number;
}

@Injectable({
  providedIn: 'root',
})
export class FirestoreService {
  private firestore = inject(Firestore);

  getProducts(): Observable<Product[]> {
    const productsCollection = collection(this.firestore, 'products');
    return collectionData(productsCollection, { idField: 'id' }) as Observable<Product[]>;
  }

  async addProduct(product: Product): Promise<void> {
    const productsCollection = collection(this.firestore, 'products');
    await addDoc(productsCollection, {
      ...product,
      price: Number(product.price),
      stock: Number(product.stock),
      available: Boolean(product.available),
      rating: Number(product.rating ?? 4.6),
      featured: Boolean(product.featured),
      createdAt: serverTimestamp(),
    });
  }

  async updateProduct(product: Product): Promise<void> {
    if (!product.id) {
      return;
    }

    const productRef = doc(this.firestore, 'products', product.id);
    await updateDoc(productRef, {
      name: product.name,
      description: product.description,
      category: product.category,
      price: Number(product.price),
      stock: Number(product.stock),
      available: Boolean(product.available),
      imageUrl: product.imageUrl,
      rating: Number(product.rating ?? 4.6),
      tags: product.tags || [],
      featured: Boolean(product.featured),
    });
  }

  async deleteProduct(productId: string): Promise<void> {
    const productRef = doc(this.firestore, 'products', productId);
    await deleteDoc(productRef);
  }

  getOrders(): Observable<FirestoreOrder[]> {
    const ordersCollection = collection(this.firestore, 'orders');
    return collectionData(ordersCollection, { idField: 'id' }) as Observable<FirestoreOrder[]>;
  }

  getCollections(): string[] {
    return ['products'];
  }

  getDocuments(collectionName: string): string[] {
    return [];
  }

  getDocumentData(collectionName: string, documentId: string): any {
    return null;
  }
}
