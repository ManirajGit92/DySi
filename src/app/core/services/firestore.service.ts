import { Injectable, inject } from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  Firestore,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from '@angular/fire/firestore';
import { catchError, map, Observable, of } from 'rxjs';
import { Booking, sampleBookings } from '../models/booking.models';
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

  getBookings(): Observable<Booking[]> {
    const bookingsCollection = collection(this.firestore, 'bookings');
    const bookingsQuery = query(bookingsCollection, orderBy('createdDate'));
    return collectionData(bookingsQuery, { idField: 'id' }).pipe(
      map((items) => items as Booking[]),
      map((bookings) => (bookings.length ? bookings : sampleBookings)),
      catchError(() => of(sampleBookings)),
    );
  }

  async addBooking(booking: Booking): Promise<void> {
    const bookingsCollection = collection(this.firestore, 'bookings');
    await addDoc(bookingsCollection, {
      ...booking,
      totalFare: Number(booking.totalFare),
      passengers: Number(booking.passengers),
      selectedSeats: booking.selectedSeats || [],
      bookingStatus: booking.bookingStatus,
      paymentStatus: booking.paymentStatus,
      createdDate: serverTimestamp(),
      updatedDate: serverTimestamp(),
    });
  }

  async updateBooking(booking: Booking): Promise<void> {
    if (!booking.id) {
      return;
    }

    const bookingRef = doc(this.firestore, 'bookings', booking.id);
    await updateDoc(bookingRef, {
      fullName: booking.fullName,
      mobileNumber: booking.mobileNumber,
      email: booking.email,
      pickupLocation: booking.pickupLocation,
      dropLocation: booking.dropLocation,
      address: booking.address,
      passengers: Number(booking.passengers),
      travelDate: booking.travelDate,
      returnDate: booking.returnDate || null,
      busType: booking.busType,
      packageName: booking.packageName,
      packageImageUrl: booking.packageImageUrl,
      specialRequests: booking.specialRequests || '',
      paymentMethod: booking.paymentMethod,
      bookingStatus: booking.bookingStatus,
      paymentStatus: booking.paymentStatus,
      selectedSeats: booking.selectedSeats || [],
      totalFare: Number(booking.totalFare),
      updatedDate: serverTimestamp(),
    });
  }

  async deleteBooking(bookingId: string): Promise<void> {
    const bookingRef = doc(this.firestore, 'bookings', bookingId);
    await deleteDoc(bookingRef);
  }

  getCollections(): string[] {
    return ['products', 'bookings'];
  }

  getDocuments(collectionName: string): string[] {
    return [];
  }

  getDocumentData(collectionName: string, documentId: string): any {
    return null;
  }
}
