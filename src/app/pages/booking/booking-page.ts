import { CommonModule } from '@angular/common';
import { computed, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
  BookingFieldConfig,
  BookingSettingsConfig,
  defaultBookingFields,
} from '../../core/models/booking.models';
import { WebsiteDataService } from '../../core/services/website-data.service';
import { NotificationService } from '../../core/services/notification.service';

interface SeatingRow {
  rowLetter: string;
  leftSeats: string[];
  rightSeats: string[];
}

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
  private readonly notificationService = inject(NotificationService);

  readonly isSubmitting = signal(false);
  readonly selectedSeats = signal<string[]>([]);
  readonly bookedSeats = signal<string[]>(['A3', 'B2', 'C4', 'D5']);
  readonly userId = signal<string | null>(null);
  readonly packages = signal<BookingPackage[]>(defaultBookingPackages);
  
  // Settings Config
  readonly bookingSettings = signal<BookingSettingsConfig | null>(null);
  readonly fieldsList = computed(() => this.bookingSettings()?.fields || []);
  
  // Seating Layout Calculations
  readonly leftColCount = computed(() => (this.bookingSettings()?.seatLayout?.layoutType === '3+2' ? 3 : 2));
  readonly rightColCount = signal<number>(2);
  readonly driverPosition = computed(() => this.bookingSettings()?.seatLayout?.driverPosition || 'left');
  readonly entrancePosition = computed(() => this.bookingSettings()?.seatLayout?.entrancePosition || 'right');

  readonly dynamicRows = computed<SeatingRow[]>(() => {
    const settings = this.bookingSettings();
    if (!settings || !settings.seatLayout) {
      return [];
    }
    const total = settings.seatLayout.totalSeats || 20;
    const leftCount = this.leftColCount();
    const rightCount = this.rightColCount();
    const seatsPerRow = leftCount + rightCount;
    const rowCount = Math.ceil(total / seatsPerRow);

    const rows: SeatingRow[] = [];
    for (let r = 0; r < rowCount; r++) {
      const rowLetter = String.fromCharCode(65 + r);
      const leftSeats: string[] = [];
      const rightSeats: string[] = [];

      // Left group
      for (let c = 0; c < leftCount; c++) {
        if (r * seatsPerRow + c < total) {
          leftSeats.push(`${rowLetter}${c + 1}`);
        }
      }

      // Right group
      for (let c = 0; c < rightCount; c++) {
        if (r * seatsPerRow + leftCount + c < total) {
          rightSeats.push(`${rowLetter}${leftCount + c + 1}`);
        }
      }

      rows.push({ rowLetter, leftSeats, rightSeats });
    }
    return rows;
  });

  readonly seatLayout = computed<string[]>(() => {
    const rows = this.dynamicRows();
    const list: string[] = [];
    rows.forEach((r) => {
      list.push(...r.leftSeats, ...r.rightSeats);
    });
    return list;
  });

  // Keep compatibility for static options if config options are empty
  readonly busTypes = computed(() => {
    const field = this.fieldsList().find((f) => f.key === 'busType');
    return field?.options || ['Mini Bus', 'AC Bus', 'Luxury Coach', 'Sleeper Bus'];
  });

  readonly paymentMethods = computed(() => {
    const field = this.fieldsList().find((f) => f.key === 'paymentMethod');
    return field?.options || ['Credit Card', 'Debit Card', 'UPI', 'Cash', 'Net Banking', 'Wallet'];
  });

  readonly bookingForm = this.fb.group({
    fullName: ['', Validators.required],
    mobileNumber: [null, [Validators.required, Validators.pattern(/^\+?[0-9]{7,15}$/)]],
    email: ['', [Validators.required, Validators.email]],
    aadhaarNumber: ['', [Validators.required, Validators.pattern(/^\d{12}$/)]],
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
  }) as FormGroup;

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

    // Load dynamic booking configurations
    this.firestoreService.getBookingSettings().subscribe({
      next: (settings) => {
        if (settings && settings.fields && settings.fields.length > 0) {
          this.bookingSettings.set(settings);
          this.applySettings(settings);
        } else {
          const defaults: BookingSettingsConfig = {
            fields: [...defaultBookingFields],
            seatLayout: {
              layoutType: '2+2',
              totalSeats: 20,
              driverPosition: 'left',
              entrancePosition: 'right',
            },
          };
          this.bookingSettings.set(defaults);
          this.applySettings(defaults);
        }
      },
      error: (err) => {
        console.error('Error loading booking settings, using defaults:', err);
        const defaults: BookingSettingsConfig = {
          fields: [...defaultBookingFields],
          seatLayout: {
            layoutType: '2+2',
            totalSeats: 20,
            driverPosition: 'left',
            entrancePosition: 'right',
          },
        };
        this.bookingSettings.set(defaults);
        this.applySettings(defaults);
      },
    });
  }

  applySettings(settings: BookingSettingsConfig): void {
    const fields = settings.fields;

    fields.forEach((field) => {
      const validators = [];
      if (field.required) {
        validators.push(Validators.required);
      }
      if (field.key === 'email') {
        validators.push(Validators.email);
      }
      if (field.key === 'mobileNumber') {
        validators.push(Validators.pattern(/^\+?[0-9]{7,15}$/));
      }
      if (field.key === 'aadhaarNumber') {
        validators.push(Validators.pattern(/^\d{12}$/));
      }

      let control = this.bookingForm.get(field.key);
      if (!control) {
        // Dynamic custom field
        control = this.fb.control(field.type === 'checkbox' ? false : '', validators);
        this.bookingForm.addControl(field.key, control);
      } else {
        // Update validators
        control.setValidators(validators);
        control.updateValueAndValidity();
      }

      // Toggle enable/disable based on visibility
      if (field.visible) {
        control.enable({ emitEvent: false });
      } else {
        control.disable({ emitEvent: false });
      }
    });

    // Remove custom fields that are no longer in the settings
    const settingKeys = new Set(fields.map((f) => f.key));
    const coreKeys = new Set([
      'fullName',
      'mobileNumber',
      'email',
      'aadhaarNumber',
      'pickupLocation',
      'dropLocation',
      'address',
      'passengers',
      'travelDate',
      'returnDate',
      'busType',
      'packageName',
      'paymentMethod',
      'specialRequests',
      'bookingStatus',
      'paymentStatus',
      'selectedSeats',
      'totalFare',
    ]);

    Object.keys(this.bookingForm.controls).forEach((key) => {
      if (!settingKeys.has(key) && !coreKeys.has(key)) {
        this.bookingForm.removeControl(key);
      }
    });
  }

  getSpacers(seats: string[], targetCount: number): any[] {
    const diff = targetCount - seats.length;
    return diff > 0 ? new Array(diff) : [];
  }

  getFieldOptions(field: BookingFieldConfig): string[] {
    if (field.key === 'packageName') {
      return this.packages().map((pkg) => pkg.name);
    }
    if (field.key === 'busType') {
      return this.busTypes();
    }
    if (field.key === 'paymentMethod') {
      return this.paymentMethods();
    }
    return field.options || [];
  }

  toggleSeat(seat: string): void {
    if (this.seatIsBooked(seat)) {
      return;
    }
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

  seatIsBooked(seat: string): boolean {
    return this.bookedSeats().includes(seat);
  }

  seatClass(seat: string): string {
    if (this.seatIsBooked(seat)) {
      return 'bus-seat bus-seat--booked';
    }
    return this.seatIsSelected(seat) ? 'bus-seat bus-seat--selected' : 'bus-seat bus-seat--available';
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

    const booking: any = {
      bookingId,
      fullName: this.bookingForm.value.fullName || '',
      mobileNumber: String(this.bookingForm.value.mobileNumber || ''),
      email: this.bookingForm.value.email || '',
      aadhaarNumber: this.bookingForm.value.aadhaarNumber || '',
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

    // Save custom fields dynamically
    const coreKeys = new Set([
      'fullName',
      'mobileNumber',
      'email',
      'aadhaarNumber',
      'pickupLocation',
      'dropLocation',
      'address',
      'passengers',
      'travelDate',
      'returnDate',
      'busType',
      'packageName',
      'paymentMethod',
      'specialRequests',
      'bookingStatus',
      'paymentStatus',
      'selectedSeats',
      'totalFare',
      'userId',
    ]);
    Object.keys(this.bookingForm.controls).forEach((key) => {
      if (!coreKeys.has(key)) {
        booking[key] = this.bookingForm.get(key)?.value;
      }
    });

    try {
      await this.firestoreService.addBooking(booking);
      this.messageService.add({
        severity: 'success',
        summary: 'Booking submitted',
        detail: 'Your tour bus booking has been saved successfully.',
      });

      this.notificationService.sendBookingConfirmation(booking).subscribe({
        next: (results) => {
          results.forEach((res) => {
            if (res.success) {
              this.messageService.add({
                severity: 'success',
                summary: `${res.type.toUpperCase()} Confirmation Sent`,
                detail: `Sent successfully to ${res.recipient}.`,
              });
            } else {
              this.messageService.add({
                severity: 'error',
                summary: `${res.type.toUpperCase()} Dispatch Failed`,
                detail: res.error || `Could not dispatch ${res.type} notification.`,
              });
            }
          });
        },
        error: (err) => {
          console.error('Failed to send booking notifications:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Notifications Failed',
            detail: 'An error occurred while sending confirmation messages.',
          });
        },
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
      aadhaarNumber: '',
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
