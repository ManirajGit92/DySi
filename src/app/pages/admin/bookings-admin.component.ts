import { CommonModule } from '@angular/common';
import { computed, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import * as XLSX from 'xlsx';
import { FirestoreService } from '../../core/services/firestore.service';
import { Booking, BookingStatus, BusType } from '../../core/models/booking.models';

@Component({
  standalone: true,
  selector: 'app-bookings-admin',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TableModule,
    SelectModule,
  ],
  templateUrl: './bookings-admin.component.html',
  styleUrls: ['./bookings-admin.component.scss'],
})
export class BookingsAdminComponent {
  private readonly firestoreService = inject(FirestoreService);

  readonly bookings = signal<Booking[]>([]);
  readonly selectedBooking = signal<Booking | null>(null);
  readonly showDialog = signal(false);
  readonly searchText = signal('');
  readonly statusFilter = signal<'All' | BookingStatus>('All');
  readonly busTypeFilter = signal<'All' | BusType>('All');
  readonly packageFilter = signal<'All' | string>('All');
  readonly dateFilter = signal<Date[] | null>(null);
  readonly rows = signal(10);

  readonly bookingStatuses: BookingStatus[] = ['Pending', 'Confirmed', 'Cancelled', 'Completed'];
  readonly busTypes: BusType[] = ['Mini Bus', 'AC Bus', 'Luxury Coach', 'Sleeper Bus'];
  selectedStatus: any;
  readonly packageOptions = computed(() => [
    'All',
    ...Array.from(new Set(this.bookings().map((booking) => booking.packageName))),
  ]);

  readonly filteredBookings = computed(() => {
    return this.bookings()
      .filter((booking) => {
        const search = this.searchText().toLowerCase();
        const matchesSearch = [
          booking.bookingId,
          booking.fullName,
          booking.email,
          booking.packageName,
          booking.busType,
        ]
          .join(' ')
          .toLowerCase()
          .includes(search);

        const matchesStatus =
          this.statusFilter() === 'All' || booking.bookingStatus === this.statusFilter();
        const matchesBusType =
          this.busTypeFilter() === 'All' || booking.busType === this.busTypeFilter();
        const matchesPackage =
          this.packageFilter() === 'All' || booking.packageName === this.packageFilter();

        let matchesDate = true;
        if (this.dateFilter() && this.dateFilter()?.length === 2) {
          const [start, end] = this.dateFilter()!;
          const travelDate = this.toDate(booking.travelDate);
          matchesDate = travelDate >= start && travelDate <= end;
        }

        return matchesSearch && matchesStatus && matchesBusType && matchesPackage && matchesDate;
      })
      .sort(
        (a, b) =>
          this.toDate(b.createdDate ?? b.travelDate).getTime() -
          this.toDate(a.createdDate ?? a.travelDate).getTime(),
      );
  });

  readonly summary = computed(() => {
    const bookings = this.bookings();
    const total = bookings.length;
    const revenue = bookings.reduce((sum, booking) => sum + booking.totalFare, 0);
    const pending = bookings.filter((booking) => booking.bookingStatus === 'Pending').length;
    const confirmed = bookings.filter((booking) => booking.bookingStatus === 'Confirmed').length;
    const cancelled = bookings.filter((booking) => booking.bookingStatus === 'Cancelled').length;
    return { total, revenue, pending, confirmed, cancelled };
  });

  constructor() {
    this.loadBookings();
  }

  async loadBookings(): Promise<void> {
    this.firestoreService.getBookings().subscribe((bookings) => {
      this.bookings.set(bookings);
    });
  }

  openDetails(booking: Booking): void {
    this.selectedBooking.set(booking);
    this.showDialog.set(true);
  }

  async updateStatus(status: BookingStatus): Promise<void> {
    const booking = this.selectedBooking();
    if (!booking) {
      return;
    }
    booking.bookingStatus = status;
    await this.firestoreService.updateBooking(booking);
    this.selectedBooking.set({ ...booking });
    this.bookings.set(this.bookings().map((item) => (item.id === booking.id ? booking : item)));
  }

  private toDate(value: string | Date | any): Date {
    if (!value) {
      return new Date(0);
    }
    if (typeof value === 'string' || value instanceof Date) {
      return new Date(value);
    }
    if (typeof value.toDate === 'function') {
      return value.toDate();
    }
    return new Date(String(value));
  }

  async deleteBooking(booking: Booking): Promise<void> {
    if (!booking.id) {
      return;
    }

    const confirmed = window.confirm(`Delete booking ${booking.bookingId}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    await this.firestoreService.deleteBooking(booking.id);
    this.bookings.set(this.bookings().filter((item) => item.id !== booking.id));
  }

  onDateRangeChange(value: string, index: 0 | 1): void {
    const current = this.dateFilter() ?? [null, null];
    const date = value ? new Date(value) : null;
    const next: Array<Date | null> = [...current];
    next[index] = date;
    this.dateFilter.set(next as Date[]);
  }

  exportBookings(): void {
    const rows = this.filteredBookings().map((booking) => ({
      BookingID: booking.bookingId,
      Name: booking.fullName,
      Email: booking.email,
      Package: booking.packageName,
      BusType: booking.busType,
      Status: booking.bookingStatus,
      Payment: booking.paymentStatus,
      TravelDate: new Date(booking.travelDate).toLocaleDateString(),
      ReturnDate: booking.returnDate ? new Date(booking.returnDate).toLocaleDateString() : '',
      Seats: booking.selectedSeats.join(', '),
      Fare: booking.totalFare,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bookings');
    XLSX.writeFile(workbook, 'tour-bookings.xlsx');
  }
}
