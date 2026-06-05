import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { BookingPageComponent } from './booking-page';
import { FirestoreService } from '../../core/services/firestore.service';
import { WebsiteDataService } from '../../core/services/website-data.service';
import { NotificationService, NotificationResult } from '../../core/services/notification.service';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { vi } from 'vitest';

describe('BookingPageComponent', () => {
  let component: BookingPageComponent;
  let fixture: ComponentFixture<BookingPageComponent>;
  let mockFirestoreService: any;
  let mockWebsiteDataService: any;
  let mockNotificationService: any;
  let messageServiceSpy: any;

  beforeEach(async () => {
    mockFirestoreService = {
      addBooking: vi.fn().mockResolvedValue(undefined),
      getBookingSettings: vi.fn().mockReturnValue(of(null)),
    };

    mockWebsiteDataService = {
      user$: of({ uid: 'test-user-id' }),
    };

    const mockResults: NotificationResult[] = [
      { success: true, type: 'email', recipient: 'john@example.com', timestamp: new Date() },
      { success: true, type: 'sms', recipient: '+919876543210', timestamp: new Date() },
    ];
    mockNotificationService = {
      sendBookingConfirmation: vi.fn().mockReturnValue(of(mockResults)),
    };

    await TestBed.configureTestingModule({
      imports: [
        BookingPageComponent,
        ReactiveFormsModule,
      ],
      providers: [
        { provide: FirestoreService, useValue: mockFirestoreService },
        { provide: WebsiteDataService, useValue: mockWebsiteDataService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(BookingPageComponent);
    component = fixture.componentInstance;
    
    const messageService = fixture.debugElement.injector.get(MessageService);
    messageServiceSpy = vi.spyOn(messageService, 'add');

    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create the booking component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default empty form fields and default package', () => {
    expect(component.bookingForm.value.packageName).toBe('City Explorer');
    expect(component.bookingForm.value.passengers).toBe(1);
    expect(component.selectedSeats().length).toBe(0);
  });

  it('should toggle seat selections and update total fare', () => {
    expect(component.seatIsSelected('A1')).toBe(false);
    component.toggleSeat('A1');
    expect(component.seatIsSelected('A1')).toBe(true);
    expect(component.selectedSeats()).toContain('A1');
    
    component.toggleSeat('A1');
    expect(component.seatIsSelected('A1')).toBe(false);
  });

  it('should not toggle seat selections if the seat is booked', () => {
    expect(component.seatIsBooked('A3')).toBe(true);
    expect(component.seatIsSelected('A3')).toBe(false);
    component.toggleSeat('A3');
    expect(component.seatIsSelected('A3')).toBe(false);
    expect(component.selectedSeats()).not.toContain('A3');
  });

  it('should call FirestoreService and NotificationService on successful submit', async () => {
    // Fill the form
    component.bookingForm.patchValue({
      fullName: 'John Doe',
      mobileNumber: '9876543210' as any,
      email: 'john@example.com',
      aadhaarNumber: '123456789012',
      pickupLocation: 'Station A',
      dropLocation: 'Hotel B',
      address: '123 Main St',
      passengers: 2,
      travelDate: new Date() as any,
      busType: 'AC Bus',
      packageName: 'City Explorer',
      paymentMethod: 'UPI',
    });

    // Select a seat (required for submit)
    component.toggleSeat('A1');
    
    fixture.detectChanges();
    
    await component.submitBooking();

    expect(mockFirestoreService.addBooking).toHaveBeenCalled();
    expect(mockNotificationService.sendBookingConfirmation).toHaveBeenCalled();
    expect(messageServiceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'Booking submitted',
      })
    );
    expect(messageServiceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'EMAIL Confirmation Sent',
      })
    );
    expect(messageServiceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'SMS Confirmation Sent',
      })
    );
  });
});
