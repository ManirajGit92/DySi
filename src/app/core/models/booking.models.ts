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
  aadhaarNumber: string;
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
      'https://i.postimg.cc/jjFpN6YX/Pngtree-a-bus-is-traveling-down-12871907.jpg',
    baseFare: 1800,
  },
  {
    name: 'Heritage Trail',
    description: 'Discover historic landmarks, curated itineraries, and cultural highlights.',
    imageUrl:
      'https://i.postimg.cc/jjFpN6YX/Pngtree-a-bus-is-traveling-down-12871907.jpg',
    baseFare: 2300,
  },
  {
    name: 'Mountain Escape',
    description: 'A scenic adventure package with hills, vistas, and a comfortable overnight bus.',
    imageUrl:
      'https://i.postimg.cc/jjFpN6YX/Pngtree-a-bus-is-traveling-down-12871907.jpg',
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
    aadhaarNumber: '987654321098',
    pickupLocation: 'MG Road, Bengaluru',
    dropLocation: 'Nandi Hills',
    address: 'No. 12, 2nd Main, Indiranagar, Bengaluru',
    passengers: 6,
    travelDate: new Date().toISOString(),
    returnDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    busType: 'AC Bus',
    packageName: 'Heritage Trail',
    packageImageUrl:
      'https://i.postimg.cc/jjFpN6YX/Pngtree-a-bus-is-traveling-down-12871907.jpg',
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

export interface BookingFieldConfig {
  key: string;
  label: string;
  placeholder: string;
  type: 'textbox' | 'number' | 'dropdown' | 'checkbox' | 'radio' | 'datepicker' | 'textarea';
  required: boolean;
  visible: boolean;
  options?: string[];
  colSpan?: number;
}

export interface BookingSettingsConfig {
  id?: string;
  fields: BookingFieldConfig[];
  seatLayout: {
    layoutType: '2+2' | '3+2';
    totalSeats: number;
    driverPosition: 'left' | 'right';
    entrancePosition: 'left' | 'right';
  };
}

export const defaultBookingFields: BookingFieldConfig[] = [
  { key: 'fullName', label: 'Full Name', placeholder: 'Your full name', type: 'textbox', required: true, visible: true, colSpan: 3 },
  { key: 'mobileNumber', label: 'Mobile Number', placeholder: '+91 9876543210', type: 'textbox', required: true, visible: true, colSpan: 3 },
  { key: 'email', label: 'Email Address', placeholder: 'you@example.com', type: 'textbox', required: true, visible: true, colSpan: 3 },
  { key: 'aadhaarNumber', label: 'Aadhaar Number', placeholder: '12-digit Aadhaar number', type: 'textbox', required: true, visible: true, colSpan: 3 },
  { key: 'pickupLocation', label: 'Pickup Location', placeholder: 'City, landmark or station', type: 'textbox', required: true, visible: true, colSpan: 3 },
  { key: 'dropLocation', label: 'Drop Location', placeholder: 'Final destination', type: 'textbox', required: true, visible: true, colSpan: 3 },
  { key: 'address', label: 'Address', placeholder: 'Pickup address or hotel details', type: 'textarea', required: true, visible: true, colSpan: 6 },
  { key: 'passengers', label: 'Number of Passengers', placeholder: '', type: 'number', required: true, visible: true, colSpan: 2 },
  { key: 'travelDate', label: 'Travel Date', placeholder: '', type: 'datepicker', required: true, visible: true, colSpan: 2 },
  { key: 'returnDate', label: 'Return Date', placeholder: '', type: 'datepicker', required: false, visible: true, colSpan: 2 },
  { key: 'busType', label: 'Bus Type', placeholder: 'Select bus type', type: 'dropdown', required: true, visible: true, colSpan: 2, options: ['Mini Bus', 'AC Bus', 'Luxury Coach', 'Sleeper Bus'] },
  { key: 'packageName', label: 'Tour Package', placeholder: 'Select package', type: 'dropdown', required: true, visible: true, colSpan: 2, options: ['City Explorer', 'Heritage Trail', 'Mountain Escape'] },
  { key: 'paymentMethod', label: 'Payment Method', placeholder: 'Select payment method', type: 'dropdown', required: true, visible: true, colSpan: 2, options: ['Credit Card', 'Debit Card', 'UPI', 'Cash', 'Net Banking', 'Wallet'] },
  { key: 'specialRequests', label: 'Special Requests / Notes', placeholder: 'Any extra requests for your journey', type: 'textarea', required: false, visible: true, colSpan: 6 }
];

