import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Firestore } from '@angular/fire/firestore';
import { NotificationService } from './notification.service';
import { Booking } from '../models/booking.models';
import { vi } from 'vitest';

// Mock @angular/fire/firestore module
vi.mock('@angular/fire/firestore', () => ({
  collection: () => ({}),
  addDoc: () => Promise.resolve({}),
  serverTimestamp: () => new Date(),
  Firestore: class {},
}));

describe('NotificationService', () => {
  let service: NotificationService;
  let httpMock: HttpTestingController;

  const mockBooking: Booking = {
    bookingId: 'DY-TEST1234',
    fullName: 'John Doe',
    mobileNumber: '9876543210',
    email: 'john@example.com',
    aadhaarNumber: '123456789012',
    pickupLocation: 'Point A',
    dropLocation: 'Point B',
    address: '123 St',
    passengers: 2,
    travelDate: new Date().toISOString(),
    busType: 'AC Bus',
    packageName: 'City Explorer',
    packageImageUrl: 'https://example.com/img.jpg',
    paymentMethod: 'UPI',
    bookingStatus: 'Confirmed',
    paymentStatus: 'Paid',
    selectedSeats: ['A1', 'A2'],
    totalFare: 2500,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        NotificationService,
        { provide: Firestore, useValue: {} },
      ],
    });
    service = TestBed.inject(NotificationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should send email successfully', () => {
    service.sendEmail('test@example.com', 'Subject', '<p>Test</p>', 'Name', 'DY-123').subscribe((result) => {
      expect(result.success).toBe(true);
      expect(result.type).toBe('email');
      expect(result.recipient).toBe('test@example.com');
      expect(result.messageId).toBe('msg-em-123');
    });

    const req = httpMock.expectOne('https://api.brevo.com/v3/smtp/email');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('api-key')).toBeDefined();
    
    req.flush({ messageId: 'msg-em-123' });
  });

  it('should handle email failure gracefully', () => {
    service.sendEmail('test@example.com', 'Subject', '<p>Test</p>', 'Name', 'DY-123').subscribe((result) => {
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid API Key');
    });

    const req = httpMock.expectOne('https://api.brevo.com/v3/smtp/email');
    req.flush({ message: 'Invalid API Key' }, { status: 401, statusText: 'Unauthorized' });
  });

  it('should send SMS successfully and format mobile number', () => {
    service.sendSMS('9876543210', 'Hello', 'DY-123').subscribe((result) => {
      expect(result.success).toBe(true);
      expect(result.type).toBe('sms');
      expect(result.recipient).toBe('+919876543210');
      expect(result.messageId).toBe('msg-sms-123');
    });

    const req = httpMock.expectOne('https://api.brevo.com/v3/transactionalSMS/sms');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.recipient).toBe('+919876543210');

    req.flush({ messageId: 'msg-sms-123' });
  });

  it('should trigger sendBookingConfirmation call for both email and SMS', () => {
    service.sendBookingConfirmation(mockBooking).subscribe((results) => {
      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    const reqEmail = httpMock.expectOne('https://api.brevo.com/v3/smtp/email');
    reqEmail.flush({ messageId: 'email-123' });

    const reqSMS = httpMock.expectOne('https://api.brevo.com/v3/transactionalSMS/sms');
    reqSMS.flush({ messageId: 'sms-123' });
  });
});
