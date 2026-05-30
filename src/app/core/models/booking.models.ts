import { Timestamp } from '@angular/fire/firestore';

export type BookingStatus = 'Pending' | 'Confirmed' | 'Cancelled' | 'Completed';
export type PaymentStatus = 'Pending' | 'Paid' | 'Failed' | 'Refunded';
export type BusType = 'Mini Bus' | 'AC Bus' | 'Luxury Coach' | 'Sleeper Bus';

export interface BookingPackage {
  name: string;
  description: string;
  imageUrl: string;
  baseFare: number;
}

export interface Booking {
  id?: string;
  bookingId: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  pickupLocation: string;
  dropLocation: string;
  address: string;
  passengers: number;
  travelDate: string;
  returnDate?: string;
  busType: BusType;
  packageName: string;
  packageImageUrl: string;
  specialRequests?: string;
  paymentMethod: string;
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;
  selectedSeats: string[];
  totalFare: number;
  createdDate?: Date | Timestamp;
  updatedDate?: Date | Timestamp;
  userId?: string | null;
}

export const defaultBookingPackages: BookingPackage[] = [
  {
    name: 'City Explorer',
    description:
      'A relaxing city tour with comfortable stops, local guides, and premium sightseeing.',
    imageUrl:
      'https://images.unsplash.com/photo-1528909514045-2fa4ac7a08ba?auto=format&fit=crop&w=1200&q=80',
    baseFare: 1800,
  },
  {
    name: 'Heritage Trail',
    description: 'Discover historic landmarks, curated itineraries, and cultural highlights.',
    imageUrl:
      'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?auto=format&fit=crop&w=1200&q=80',
    baseFare: 2300,
  },
  {
    name: 'Mountain Escape',
    description: 'A scenic adventure package with hills, vistas, and a comfortable overnight bus.',
    imageUrl:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    baseFare: 3200,
  },
];

export const sampleBookings: Booking[] = [
  {
    id: 'sample-1',
    bookingId: 'DY-8A9F7B1C',
    fullName: 'Anaya Sharma',
    mobileNumber: '+919876543210',
    email: 'anaya@example.com',
    pickupLocation: 'MG Road, Bengaluru',
    dropLocation: 'Nandi Hills',
    address: 'No. 12, 2nd Main, Indiranagar, Bengaluru',
    passengers: 6,
    travelDate: new Date().toISOString(),
    returnDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    busType: 'AC Bus',
    packageName: 'Heritage Trail',
    packageImageUrl:
      'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?auto=format&fit=crop&w=1200&q=80',
    specialRequests: 'Need a child seat and vegan snacks.',
    paymentMethod: 'UPI',
    bookingStatus: 'Confirmed',
    paymentStatus: 'Paid',
    selectedSeats: ['B1', 'B2', 'B3', 'B4', 'B5', 'C1'],
    totalFare: 5760,
    createdDate: new Date(),
    updatedDate: new Date(),
    userId: null,
  },
];
