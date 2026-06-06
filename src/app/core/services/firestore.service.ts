import { Injectable, inject } from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  docData,
  Firestore,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { catchError, map, Observable, of } from 'rxjs';
import { Booking, sampleBookings, BookingSettingsConfig } from '../models/booking.models';
import { Product } from '../models/product.models';

export interface SeatHold {
  id?: string;
  packageName: string;
  busType: string;
  travelDate: string;  // YYYY-MM-DD
  seat: string;
  sessionId: string;
  userId: string | null;
  heldAt: any;
  expiresAt: any;      // Timestamp (heldAt + 5 min)
}

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

  constructor() {
    this.migrateBookingsToOccupiedSeats();
  }

  private async migrateBookingsToOccupiedSeats() {
    try {
      const bookingsRef = collection(this.firestore, 'bookings');
      const snapshot = await getDocs(bookingsRef);
      const occupiedRef = collection(this.firestore, 'occupied_seats');
      const occupiedSnapshot = await getDocs(occupiedRef);
      
      if (occupiedSnapshot.empty && !snapshot.empty) {
        console.log('Seeding occupied_seats collection from existing bookings...');
        for (const d of snapshot.docs) {
          const booking = d.data() as Booking;
          await setDoc(doc(this.firestore, 'occupied_seats', d.id), {
            bookingId: booking.bookingId,
            packageName: booking.packageName,
            busType: booking.busType,
            travelDate: this.toIsoDateString(booking.travelDate),
            seats: booking.selectedSeats || [],
            bookingStatus: booking.bookingStatus || 'Confirmed',
            updatedAt: serverTimestamp(),
          });
        }
        console.log('Seeding occupied_seats complete.');
      }
    } catch (e) {
      // Bypassed if standard user lacks read permissions on 'bookings' (which is expected)
    }
  }

  private toIsoDateString(value: Date | string | null | undefined): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    return date.toISOString().split('T')[0];
  }

  async addBooking(booking: Booking): Promise<string> {
    const bookingsCollection = collection(this.firestore, 'bookings');
    const docRef = await addDoc(bookingsCollection, {
      ...booking,
      email: (booking.email || '').toLowerCase().trim(),
      totalFare: Number(booking.totalFare),
      passengers: Number(booking.passengers),
      selectedSeats: booking.selectedSeats || [],
      bookingStatus: booking.bookingStatus,
      paymentStatus: booking.paymentStatus,
      createdDate: serverTimestamp(),
      updatedDate: serverTimestamp(),
    });

    const occupiedRef = doc(this.firestore, 'occupied_seats', docRef.id);
    await setDoc(occupiedRef, {
      bookingId: booking.bookingId,
      packageName: booking.packageName,
      busType: booking.busType,
      travelDate: this.toIsoDateString(booking.travelDate),
      seats: booking.selectedSeats || [],
      bookingStatus: booking.bookingStatus,
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  }

  async updateBooking(booking: Booking): Promise<void> {
    if (!booking.id) {
      return;
    }

    const bookingRef = doc(this.firestore, 'bookings', booking.id);
    await updateDoc(bookingRef, {
      fullName: booking.fullName,
      mobileNumber: booking.mobileNumber,
      email: (booking.email || '').toLowerCase().trim(),
      aadhaarNumber: booking.aadhaarNumber,
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

    const occupiedRef = doc(this.firestore, 'occupied_seats', booking.id);
    await setDoc(occupiedRef, {
      bookingId: booking.bookingId,
      packageName: booking.packageName,
      busType: booking.busType,
      travelDate: this.toIsoDateString(booking.travelDate),
      seats: booking.selectedSeats || [],
      bookingStatus: booking.bookingStatus,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  async deleteBooking(bookingId: string): Promise<void> {
    const bookingRef = doc(this.firestore, 'bookings', bookingId);
    await deleteDoc(bookingRef);

    const occupiedRef = doc(this.firestore, 'occupied_seats', bookingId);
    await deleteDoc(occupiedRef);
  }

  private toDate(val: any): Date {
    if (!val) {
      return new Date(0);
    }
    if (val instanceof Date) {
      return val;
    }
    if (typeof val.toDate === 'function') {
      return val.toDate();
    }
    if (typeof val.seconds === 'number') {
      return new Date(val.seconds * 1000 + (val.nanoseconds ? val.nanoseconds / 1000000 : 0));
    }
    return new Date(val);
  }

  getBookingsByUserEmail(email: string): Observable<Booking[]> {
    if (!email) return of([]);
    const bookingsCollection = collection(this.firestore, 'bookings');
    const bookingsQuery = query(bookingsCollection, where('email', '==', email.toLowerCase().trim()));
    return collectionData(bookingsQuery, { idField: 'id' }).pipe(
      map((items) => items as Booking[]),
      map((bookings) => bookings.sort((a, b) => {
        const dateA = this.toDate(a.createdDate ?? a.travelDate).getTime();
        const dateB = this.toDate(b.createdDate ?? b.travelDate).getTime();
        return dateB - dateA;
      })),
      catchError(() => of([]))
    );
  }

  getOccupiedSeats(): Observable<any[]> {
    const colRef = collection(this.firestore, 'occupied_seats');
    return collectionData(colRef, { idField: 'id' }) as Observable<any[]>;
  }

  // ── Seat Hold / Locking ────────────────────────────────────────────────────

  /** Streams all active seat holds in real-time. */
  getActiveHolds(): Observable<SeatHold[]> {
    const colRef = collection(this.firestore, 'seat_holds');
    return collectionData(colRef, { idField: 'id' }) as Observable<SeatHold[]>;
  }

  /**
   * Places a 5-minute hold on a seat for the given session.
   * Returns the Firestore document ID of the hold.
   */
  async holdSeat(hold: Omit<SeatHold, 'id' | 'heldAt' | 'expiresAt'>): Promise<string> {
    const colRef = collection(this.firestore, 'seat_holds');
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + 5 * 60 * 1000); // +5 minutes
    const docRef = await addDoc(colRef, {
      ...hold,
      heldAt: now,
      expiresAt,
    });
    return docRef.id;
  }

  /** Releases a single seat hold by its document ID. */
  async releaseSeat(holdId: string): Promise<void> {
    try {
      await deleteDoc(doc(this.firestore, 'seat_holds', holdId));
    } catch {
      // Hold may already be gone — safe to ignore
    }
  }

  /** Releases ALL seat holds belonging to this browser session. */
  async releaseSessionSeats(sessionId: string): Promise<void> {
    try {
      const colRef = collection(this.firestore, 'seat_holds');
      const q = query(colRef, where('sessionId', '==', sessionId));
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    } catch {
      // Best-effort cleanup
    }
  }

  /**
   * Marks a booking as payment-completed and booking-confirmed.
   * Also removes any lingering seat holds for this session.
   */
  async completePayment(bookingDocId: string, sessionId: string): Promise<void> {
    const bookingRef = doc(this.firestore, 'bookings', bookingDocId);
    await updateDoc(bookingRef, {
      paymentStatus: 'Completed',
      bookingStatus: 'Confirmed',
      updatedDate: serverTimestamp(),
    });
    // Also sync occupied_seats status
    const occupiedRef = doc(this.firestore, 'occupied_seats', bookingDocId);
    await setDoc(occupiedRef, { bookingStatus: 'Confirmed' }, { merge: true });
    // Clean up holds for this session
    await this.releaseSessionSeats(sessionId);
  }

  getDefaultBookingInfo(email: string): Observable<any> {
    if (!email) return of(null);
    const docRef = doc(this.firestore, 'default_booking_info', email.toLowerCase().trim());
    return docData(docRef) as Observable<any>;
  }

  async saveDefaultBookingInfo(email: string, info: any): Promise<void> {
    if (!email) return;
    const normalizedEmail = email.toLowerCase().trim();
    const docRef = doc(this.firestore, 'default_booking_info', normalizedEmail);
    await setDoc(docRef, {
      ...info,
      email: normalizedEmail,
      updatedAt: serverTimestamp()
    });
  }

  async saveColumnPreferences(email: string, fields: string[]): Promise<void> {
    if (!email) return;
    const docRef = doc(this.firestore, 'default_booking_info', email.toLowerCase().trim());
    await setDoc(docRef, {
      columnPreferences: fields
    }, { merge: true });
  }

  async saveAdminColumnPreferences(email: string, fields: string[]): Promise<void> {
    if (!email) return;
    const docRef = doc(this.firestore, 'admin_preferences', email.toLowerCase().trim());
    await setDoc(docRef, { adminColumnPreferences: fields }, { merge: true });
  }

  getAdminColumnPreferences(email: string): Observable<string[]> {
    if (!email) return of([]);
    const docRef = doc(this.firestore, 'admin_preferences', email.toLowerCase().trim());
    return (docData(docRef) as Observable<any>).pipe(
      map(data => (data?.adminColumnPreferences as string[]) || []),
      catchError(() => of([]))
    );
  }

  getBookingSettings(): Observable<BookingSettingsConfig | null> {
    const docRef = doc(this.firestore, 'booking_settings', 'current');
    return docData(docRef) as Observable<BookingSettingsConfig | null>;
  }

  async saveBookingSettings(settings: BookingSettingsConfig): Promise<void> {
    const docRef = doc(this.firestore, 'booking_settings', 'current');
    await setDoc(docRef, {
      fields: settings.fields,
      seatLayout: settings.seatLayout,
      updatedAt: serverTimestamp(),
    });
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
