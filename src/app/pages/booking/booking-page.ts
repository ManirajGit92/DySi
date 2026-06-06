import { CommonModule } from '@angular/common';
import { computed, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TabsModule } from 'primeng/tabs';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { FirestoreService } from '../../core/services/firestore.service';
import { Booking, BookingPackage, BookingStatus, PaymentStatus, BusType, defaultBookingPackages, BookingFieldConfig, BookingSettingsConfig, defaultBookingFields } from '../../core/models/booking.models';
import { WebsiteDataService } from '../../core/services/website-data.service';
import { NotificationService } from '../../core/services/notification.service';

interface SeatingRow {
  rowLetter: string;
  leftSeats: string[];
  rightSeats: string[];
}

export interface TableColumn {
  field: string;
  header: string;
  visible: boolean;
}

@Component({
  standalone: true,
  selector: 'app-booking-page',
  templateUrl: './booking-page.html',
  styleUrls: ['./booking-page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    DatePickerModule,
    SelectModule,
    MultiSelectModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    ToastModule,
    TabsModule,
    TableModule,
    DialogModule,
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
  readonly userId = signal<string | null>(null);
  readonly packages = signal<BookingPackage[]>(defaultBookingPackages);

  // Real-time bookings from Firestore
  readonly allBookings = toSignal(this.firestoreService.getBookings(), { initialValue: [] });
  // Real-time occupied seats from Firestore
  readonly allOccupiedSeats = toSignal(this.firestoreService.getOccupiedSeats(), { initialValue: [] });

  // Dynamically calculate booked/occupied seats for the chosen package, date, and bus type
  readonly bookedSeats = computed(() => {
    const travelDate = this.bookingForm.value.travelDate;
    const packageName = this.bookingForm.value.packageName;
    const busType = this.bookingForm.value.busType;
    if (!travelDate || !packageName || !busType) {
      return [];
    }

    const formattedDate = this.toIsoDateString(travelDate);
    return this.allOccupiedSeats()
      .filter(s => s.bookingStatus !== 'Cancelled' && 
                   s.packageName === packageName && 
                   s.busType === busType &&
                   s.travelDate === formattedDate)
      .reduce((seats, s) => {
        if (s.seats) {
          seats.push(...s.seats);
        }
        return seats;
      }, [] as string[]);
  });

  // Table Columns customization
  readonly columns = signal<TableColumn[]>([
    { field: 'bookingId', header: 'Booking ID', visible: true },
    { field: 'fullName', header: 'Passenger Name', visible: true },
    { field: 'travelDate', header: 'Travel Date', visible: true },
    { field: 'packageName', header: 'Package Details', visible: true },
    { field: 'pickupLocation', header: 'Pickup Location', visible: true },
    { field: 'dropLocation', header: 'Drop Location', visible: true },
    { field: 'selectedSeats', header: 'Seat Number', visible: true },
    { field: 'totalFare', header: 'Fare', visible: true },
    { field: 'bookingStatus', header: 'Status', visible: true },
  ]);

  // Drives the p-multiSelect for column visibility – list of currently-visible field keys
  readonly selectedColumnFields = signal<string[]>(
    this.columns().filter(c => c.visible).map(c => c.field)
  );

  /** Called when the user changes the multiSelect dropdown. Syncs visibility + persists. */
  onColumnsChange(selectedFields: string[]): void {
    this.selectedColumnFields.set(selectedFields);
    this.columns.update(cols =>
      cols.map(c => ({ ...c, visible: selectedFields.includes(c.field) }))
    );
    const email = this.bookingForm.value.email || this.defaultInfoForm.value.email;
    if (email) {
      this.firestoreService.saveColumnPreferences(email, selectedFields).catch(err => {
        console.error('Failed to save column preferences:', err);
      });
    }
  }

  getVisibleColumns() {
    return this.columns().filter(c => c.visible);
  }

  // Default booking info form
  readonly defaultInfoForm = this.fb.group({
    fullName: ['', Validators.required],
    mobileNumber: [null, [Validators.required, Validators.pattern(/^\+?[0-9]{7,15}$/)]],
    email: ['', [Validators.required, Validators.email]],
    aadhaarNumber: ['', [Validators.required, Validators.pattern(/^\d{12}$/)]],
    address: ['', Validators.required],
    pickupLocation: ['', Validators.required],
    dropLocation: ['', Validators.required],
  });

  // Edit ticket form
  readonly editBookingForm = this.fb.group({
    fullName: ['', Validators.required],
    mobileNumber: [null, [Validators.required, Validators.pattern(/^\+?[0-9]{7,15}$/)]],
    email: ['', [Validators.required, Validators.email]],
    aadhaarNumber: ['', [Validators.required, Validators.pattern(/^\d{12}$/)]],
    address: ['', Validators.required],
    pickupLocation: ['', Validators.required],
    dropLocation: ['', Validators.required],
    specialRequests: [''],
  });

  readonly userBookings = signal<Booking[]>([]);
  readonly searchQuery = signal('');
  readonly statusFilter = signal('All');

  // Filtered user bookings for the table search
  readonly filteredUserBookings = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    
    return this.userBookings().filter(b => {
      const matchesSearch = 
        b.bookingId?.toLowerCase().includes(query) ||
        b.packageName?.toLowerCase().includes(query) ||
        b.fullName?.toLowerCase().includes(query);
        
      const matchesStatus = status === 'All' || b.bookingStatus === status;
      return matchesSearch && matchesStatus;
    });
  });

  // Controls for Modals
  readonly isDetailsOpen = signal(false);
  readonly selectedViewBooking = signal<Booking | null>(null);

  readonly isEditOpen = signal(false);
  readonly selectedEditBooking = signal<Booking | null>(null);
  
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
    this.websiteData.user$.subscribe((user) => {
      this.userId.set(user?.uid ?? null);
      const email = user?.email;
      if (email) {
        // Load bookings history for this email in real time
        this.firestoreService.getBookingsByUserEmail(email).subscribe({
          next: (history) => {
            this.userBookings.set(history);
          },
          error: (err) => console.error('Failed to load user bookings history:', err)
        });

        // Load default booking info
        this.firestoreService.getDefaultBookingInfo(email).subscribe({
          next: (defaults) => {
            if (defaults) {
              this.defaultInfoForm.patchValue(defaults, { emitEvent: false });
              // Apply saved column preferences
              if (defaults.columnPreferences) {
                const prefs = new Set(defaults.columnPreferences);
                this.columns.update(cols => cols.map(c => ({
                  ...c,
                  visible: prefs.has(c.field)
                })));
                // keep multiSelect dropdown in sync
                this.selectedColumnFields.set(defaults.columnPreferences as string[]);
              }
              // Auto-populate main booking form if pristine
              if (this.bookingForm.pristine) {
                this.bookingForm.patchValue(defaults);
              }
            }
          },
          error: (err) => console.error('Failed to load default booking info:', err)
        });
      } else {
        this.userBookings.set([]);
      }
    });

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

    // Prevent duplicate seat booking
    const currentBooked = this.bookedSeats();
    const overlapping = this.selectedSeats().filter(seat => currentBooked.includes(seat));
    if (overlapping.length > 0) {
      this.messageService.add({
        severity: 'error',
        summary: 'Seats already booked',
        detail: `The following seats were just booked by another traveler: ${overlapping.join(', ')}. Please select other seats.`,
      });
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

  private toIsoString(value: Date | string | null | undefined): string | null {
    if (!value) {
      return null;
    }
    const date = value instanceof Date ? value : new Date(value);
    return date.toISOString();
  }

  private toIsoDateString(value: Date | string | null | undefined): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    return date.toISOString().split('T')[0];
  }

  async saveDefaultInfo(): Promise<void> {
    const email = this.defaultInfoForm.value.email || this.bookingForm.value.email;
    if (!email) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Email Required',
        detail: 'Please log in or enter an email address in Default Info to save.',
      });
      return;
    }
    
    try {
      await this.firestoreService.saveDefaultBookingInfo(email, this.defaultInfoForm.value);
      this.messageService.add({
        severity: 'success',
        summary: 'Defaults Saved',
        detail: 'Your default booking information has been saved successfully.',
      });
    } catch (error) {
      console.error(error);
      this.messageService.add({
        severity: 'error',
        summary: 'Save Failed',
        detail: 'Unable to save default booking details. Check permissions.',
      });
    }
  }

  openDetails(booking: Booking): void {
    this.selectedViewBooking.set(booking);
    this.isDetailsOpen.set(true);
  }

  closeDetails(): void {
    this.selectedViewBooking.set(null);
    this.isDetailsOpen.set(false);
  }

  openEdit(booking: Booking): void {
    if (booking.bookingStatus !== 'Pending') {
      this.messageService.add({
        severity: 'warn',
        summary: 'Action restricted',
        detail: 'Only bookings with "Pending" status can be modified.',
      });
      return;
    }
    this.selectedEditBooking.set(booking);
    this.editBookingForm.patchValue({
      fullName: booking.fullName,
      mobileNumber: booking.mobileNumber as any,
      email: booking.email,
      aadhaarNumber: booking.aadhaarNumber,
      address: booking.address,
      pickupLocation: booking.pickupLocation,
      dropLocation: booking.dropLocation,
      specialRequests: booking.specialRequests || '',
    });
    this.isEditOpen.set(true);
  }

  closeEdit(): void {
    this.selectedEditBooking.set(null);
    this.isEditOpen.set(false);
  }

  async updateTicket(): Promise<void> {
    const booking = this.selectedEditBooking();
    if (!booking || !booking.id) return;
    
    if (this.editBookingForm.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Incomplete form',
        detail: 'Please fill in all required fields.',
      });
      return;
    }
    
    const updated: Booking = {
      ...booking,
      fullName: this.editBookingForm.value.fullName || '',
      mobileNumber: String(this.editBookingForm.value.mobileNumber || ''),
      email: this.editBookingForm.value.email || '',
      aadhaarNumber: this.editBookingForm.value.aadhaarNumber || '',
      address: this.editBookingForm.value.address || '',
      pickupLocation: this.editBookingForm.value.pickupLocation || '',
      dropLocation: this.editBookingForm.value.dropLocation || '',
      specialRequests: this.editBookingForm.value.specialRequests || '',
    };
    
    try {
      await this.firestoreService.updateBooking(updated);
      this.messageService.add({
        severity: 'success',
        summary: 'Booking Updated',
        detail: 'Your booking details have been modified successfully.',
      });
      this.closeEdit();
    } catch (error) {
      console.error(error);
      this.messageService.add({
        severity: 'error',
        summary: 'Update Failed',
        detail: 'Unable to update booking information.',
      });
    }
  }

  async cancelTicket(booking: Booking): Promise<void> {
    if (booking.bookingStatus === 'Cancelled') {
      return;
    }
    
    if (!confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
      return;
    }
    
    const updated: Booking = {
      ...booking,
      bookingStatus: 'Cancelled',
    };
    
    try {
      await this.firestoreService.updateBooking(updated);
      this.messageService.add({
        severity: 'success',
        summary: 'Booking Cancelled',
        detail: `Booking ID ${booking.bookingId} has been cancelled successfully.`,
      });
    } catch (error) {
      console.error(error);
      this.messageService.add({
        severity: 'error',
        summary: 'Cancellation Failed',
        detail: 'Unable to cancel the booking. Please check database permissions.',
      });
    }
  }
}
