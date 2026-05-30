import { CommonModule } from '@angular/common';
import { computed, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { FirestoreService } from '../../core/services/firestore.service';
import {
  Booking,
  BookingPackage,
  BookingStatus,
  PaymentStatus,
  BusType,
  defaultBookingPackages,
} from '../../core/models/booking.models';
import { WebsiteDataService } from '../../core/services/website-data.service';

@Component({
  standalone: true,
  selector: 'app-booking-page',
  templateUrl: './booking-page.html',
  styleUrls: ['./booking-page.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    DatePickerModule,
    SelectModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    ToastModule,
  ],
  providers: [MessageService],
})
export class BookingPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly firestoreService = inject(FirestoreService);
  private readonly websiteData = inject(WebsiteDataService);
  private readonly messageService = inject(MessageService);

  readonly isSubmitting = signal(false);
  readonly selectedSeats = signal<string[]>([]);
  readonly userId = signal<string | null>(null);
  readonly packages = signal<BookingPackage[]>(defaultBookingPackages);
  readonly busTypes = signal<BusType[]>(['Mini Bus', 'AC Bus', 'Luxury Coach', 'Sleeper Bus']);
  readonly paymentMethods = signal<string[]>([
    'Credit Card',
    'Debit Card',
    'UPI',
    'Cash',
    'Net Banking',
    'Wallet',
  ]);
  readonly seatLayout = signal<string[]>([
    'A1',
    'A2',
    'A3',
    'A4',
    'A5',
    'B1',
    'B2',
    'B3',
    'B4',
    'B5',
    'C1',
    'C2',
    'C3',
    'C4',
    'C5',
    'D1',
    'D2',
    'D3',
    'D4',
    'D5',
  ]);

  readonly bookingForm = this.fb.group({
    fullName: ['', Validators.required],
    mobileNumber: [null, [Validators.required, Validators.pattern(/^\+?[0-9]{7,15}$/)]],
    email: ['', [Validators.required, Validators.email]],
    pickupLocation: ['', Validators.required],
    dropLocation: ['', Validators.required],
    address: ['', Validators.required],
    passengers: [1, [Validators.required, Validators.min(1), Validators.max(40)]],
    travelDate: [null, Validators.required],
    returnDate: [null],
    busType: [null as BusType | null, Validators.required],
    packageName: ['City Explorer', Validators.required],
    specialRequests: [''],
    paymentMethod: ['UPI', Validators.required],
    bookingStatus: ['Pending' as BookingStatus],
    paymentStatus: ['Pending' as PaymentStatus],
    selectedSeats: [[] as string[]],
    totalFare: [0],
  });

  readonly selectedPackage = computed(() => {
    const packageName = this.bookingForm.value.packageName;
    return this.packages().find((pkg) => pkg.name === packageName) ?? this.packages()[0];
  });

  readonly fareEstimate = computed(() => this.calculateFare());

  constructor() {
    this.websiteData.user$.subscribe((user) => this.userId.set(user?.uid ?? null));
    this.bookingForm.valueChanges.subscribe(() => {
      this.bookingForm.patchValue({ totalFare: this.fareEstimate() }, { emitEvent: false });
    });
  }

  toggleSeat(seat: string): void {
    const selected = [...this.selectedSeats()];
    const index = selected.indexOf(seat);

    if (index >= 0) {
      selected.splice(index, 1);
    } else {
      selected.push(seat);
    }

    this.selectedSeats.set(selected);
    this.bookingForm.patchValue({ selectedSeats: selected } as any, { emitEvent: false });
  }

  seatIsSelected(seat: string): boolean {
    return this.selectedSeats().includes(seat);
  }

  seatClass(seat: string): string {
    return this.seatIsSelected(seat) ? 'seat seat--selected' : 'seat';
  }

  calculateFare(): number {
    const values = this.bookingForm.value;
    const basePackage = this.packages().find((pkg) => pkg.name === values.packageName);
    const packageFare = basePackage?.baseFare ?? 0;
    const passengerCount = Number(values.passengers) || 1;

    let busSurcharge = 0;
    switch (values.busType) {
      case 'AC Bus':
        busSurcharge = 320;
        break;
      case 'Luxury Coach':
        busSurcharge = 820;
        break;
      case 'Sleeper Bus':
        busSurcharge = 550;
        break;
      default:
        busSurcharge = 160;
    }

    const seatCharge = this.selectedSeats().length * 120;
    const passengerCharge = passengerCount * 290;
    return Math.max(0, packageFare + busSurcharge + passengerCharge + seatCharge);
  }

  async submitBooking(): Promise<void> {
    if (this.bookingForm.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Incomplete form',
        detail: 'Please fill in all required details before booking.',
      });
      return;
    }

    if (!this.selectedSeats().length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Choose seats',
        detail: 'Select at least one seat to reserve your tour bus booking.',
      });
      return;
    }

    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    const bookingId = `DY-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
    const selectedPackage = this.selectedPackage();

    const booking: Booking = {
      bookingId,
      fullName: this.bookingForm.value.fullName || '',
      mobileNumber: String(this.bookingForm.value.mobileNumber || ''),
      email: this.bookingForm.value.email || '',
      pickupLocation: this.bookingForm.value.pickupLocation || '',
      dropLocation: this.bookingForm.value.dropLocation || '',
      address: this.bookingForm.value.address || '',
      passengers: Number(this.bookingForm.value.passengers) || 1,
      travelDate: this.toIsoString(this.bookingForm.value.travelDate) || new Date().toISOString(),
      returnDate: this.toIsoString(this.bookingForm.value.returnDate),
      busType: this.bookingForm.value.busType as BusType,
      packageName: selectedPackage.name,
      packageImageUrl: selectedPackage.imageUrl,
      specialRequests: this.bookingForm.value.specialRequests || '',
      paymentMethod: this.bookingForm.value.paymentMethod || 'UPI',
      bookingStatus: 'Pending',
      paymentStatus: 'Pending',
      selectedSeats: [...this.selectedSeats()],
      totalFare: this.calculateFare(),
      userId: this.userId(),
    };

    try {
      await this.firestoreService.addBooking(booking);
      this.messageService.add({
        severity: 'success',
        summary: 'Booking submitted',
        detail: 'Your tour bus booking has been saved successfully.',
      });
      this.resetForm();
    } catch (error) {
      console.error(error);
      this.messageService.add({
        severity: 'error',
        summary: 'Booking failed',
        detail: 'Unable to save your booking. Please try again later.',
      });
    } finally {
      this.isSubmitting.set(false);
    }
  }

  resetForm(): void {
    this.selectedSeats.set([]);
    this.bookingForm.reset({
      fullName: '',
      mobileNumber: null,
      email: '',
      pickupLocation: '',
      dropLocation: '',
      address: '',
      passengers: 1,
      travelDate: null,
      returnDate: null,
      busType: null,
      packageName: this.packages()[0].name,
      specialRequests: '',
      paymentMethod: 'UPI',
      bookingStatus: 'Pending',
      paymentStatus: 'Pending',
      selectedSeats: [] as string[],
      totalFare: 0,
    });
  }

  private toIsoString(value: Date | string | null | undefined): string | undefined {
    if (!value) {
      return undefined;
    }
    const date = value instanceof Date ? value : new Date(value);
    return date.toISOString();
  }
}
