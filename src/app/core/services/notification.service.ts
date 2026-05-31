import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Firestore, collection, addDoc, serverTimestamp } from '@angular/fire/firestore';
import { Observable, forkJoin, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Booking } from '../models/booking.models';

export type NotificationType = 'email' | 'sms';

export interface NotificationResult {
  success: boolean;
  type: NotificationType;
  recipient: string;
  timestamp: Date;
  messageId?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly firestore = inject(Firestore);

  private readonly brevoApiUrl = 'https://api.brevo.com/v3';
  private readonly apiKey = environment.brevo.apiKey;
  private readonly senderEmail = environment.brevo.senderEmail;
  private readonly senderName = environment.brevo.senderName;

  /**
   * Sends both email and SMS booking confirmations.
   */
  sendBookingConfirmation(booking: Booking): Observable<NotificationResult[]> {
    const email$ = this.sendEmail(
      booking.email,
      `Booking Confirmed - Ticket ${booking.bookingId}`,
      this.generateHtmlEmail(booking),
      booking.fullName,
      booking.bookingId
    );

    const sms$ = this.sendSMS(
      booking.mobileNumber,
      this.generateSMSBody(booking),
      booking.bookingId
    );

    return forkJoin([email$, sms$]);
  }

  /**
   * Sends transactional email using Brevo SMTP API.
   */
  sendEmail(
    toEmail: string,
    subject: string,
    htmlContent: string,
    recipientName: string,
    bookingId?: string
  ): Observable<NotificationResult> {
    const headers = new HttpHeaders({
      'api-key': this.apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    });

    const payload = {
      sender: { name: this.senderName, email: this.senderEmail },
      to: [{ email: toEmail, name: recipientName }],
      subject: subject,
      htmlContent: htmlContent,
    };

    return this.http
      .post<any>(`${this.brevoApiUrl}/smtp/email`, payload, { headers })
      .pipe(
        map((response) => {
          const result: NotificationResult = {
            success: true,
            type: 'email',
            recipient: toEmail,
            timestamp: new Date(),
            messageId: response?.messageId,
          };
          
          this.logNotificationToFirestore({
            bookingId,
            type: 'email',
            recipient: toEmail,
            subject,
            message: 'HTML Content Sent',
            status: 'delivered',
            response,
          });

          return result;
        }),
        catchError((error) => {
          const errorMessage = error?.error?.message || error?.message || 'Failed to send email';
          const result: NotificationResult = {
            success: false,
            type: 'email',
            recipient: toEmail,
            timestamp: new Date(),
            error: errorMessage,
          };

          this.logNotificationToFirestore({
            bookingId,
            type: 'email',
            recipient: toEmail,
            subject,
            message: 'HTML Content Failed to Send',
            status: 'failed',
            error: errorMessage,
          });

          return of(result);
        })
      );
  }

  /**
   * Sends transactional SMS using Brevo SMS API.
   */
  sendSMS(
    toMobile: string,
    content: string,
    bookingId?: string
  ): Observable<NotificationResult> {
    const headers = new HttpHeaders({
      'api-key': this.apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    });

    // Clean phone number (Brevo requires international format starting with country code e.g. +91...)
    let formattedMobile = toMobile.trim();
    if (!formattedMobile.startsWith('+') && !formattedMobile.startsWith('00')) {
      // If it doesn't start with +, prefix it with +91 (India) as default since the active users/samples show India numbers,
      // or assume standard + if starts with country code. Let's make it robust by adding + if numeric starts without it.
      if (/^\d+$/.test(formattedMobile)) {
        // If it starts with 91 and has 12 digits, just prefix +
        if (formattedMobile.startsWith('91') && formattedMobile.length === 12) {
          formattedMobile = '+' + formattedMobile;
        } else {
          // Default to India country code if length is 10 digits
          formattedMobile = '+91' + formattedMobile;
        }
      }
    }

    const payload = {
      sender: 'DySiTours', // Max 11 characters alphanumeric
      recipient: formattedMobile,
      content: content,
    };

    return this.http
      .post<any>(`${this.brevoApiUrl}/transactionalSMS/sms`, payload, { headers })
      .pipe(
        map((response) => {
          const result: NotificationResult = {
            success: true,
            type: 'sms',
            recipient: formattedMobile,
            timestamp: new Date(),
            messageId: response?.messageId,
          };

          this.logNotificationToFirestore({
            bookingId,
            type: 'sms',
            recipient: formattedMobile,
            message: content,
            status: 'delivered',
            response,
          });

          return result;
        }),
        catchError((error) => {
          const errorMessage = error?.error?.message || error?.message || 'Failed to send SMS';
          const result: NotificationResult = {
            success: false,
            type: 'sms',
            recipient: formattedMobile,
            timestamp: new Date(),
            error: errorMessage,
          };

          this.logNotificationToFirestore({
            bookingId,
            type: 'sms',
            recipient: formattedMobile,
            message: content,
            status: 'failed',
            error: errorMessage,
          });

          return of(result);
        })
      );
  }

  private logNotificationToFirestore(log: {
    bookingId?: string;
    type: NotificationType;
    recipient: string;
    subject?: string;
    message: string;
    status: 'delivered' | 'failed';
    error?: string;
    response?: any;
  }): void {
    const notificationsCollection = collection(this.firestore, 'notifications');
    addDoc(notificationsCollection, {
      ...log,
      sentAt: serverTimestamp(),
    }).catch((err) => {
      console.error('Failed to log notification to Firestore:', err);
    });
  }

  private generateHtmlEmail(booking: Booking): string {
    const travelDate = new Date(booking.travelDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const returnDate = booking.returnDate
      ? new Date(booking.returnDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : null;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Confirmation - DySi Tours</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            background-color: #f4f6fa;
            color: #333333;
            margin: 0;
            padding: 0;
          }
          .email-container {
            max-width: 600px;
            margin: 20px auto;
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          }
          .header {
            background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
            color: #ffffff;
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 0.5px;
          }
          .header p {
            margin: 5px 0 0 0;
            font-size: 14px;
            opacity: 0.9;
          }
          .content {
            padding: 40px 30px;
          }
          .welcome-text {
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 30px;
          }
          .booking-card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 24px;
            margin-bottom: 30px;
          }
          .booking-card h2 {
            margin: 0 0 20px 0;
            font-size: 18px;
            color: #1e3a8a;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 8px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            font-size: 14px;
          }
          .detail-row:last-child {
            margin-bottom: 0;
          }
          .detail-label {
            color: #64748b;
            font-weight: 500;
            width: 40%;
          }
          .detail-value {
            color: #0f172a;
            font-weight: 600;
            width: 60%;
            text-align: right;
          }
          .fare-row {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px dashed #cbd5e1;
            font-size: 16px;
          }
          .fare-row .detail-value {
            color: #10b981;
            font-size: 18px;
          }
          .footer {
            background-color: #f1f5f9;
            color: #64748b;
            padding: 20px;
            text-align: center;
            font-size: 12px;
          }
          .footer p {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>Booking Confirmed!</h1>
            <p>Ticket ID: ${booking.bookingId}</p>
          </div>
          <div class="content">
            <p class="welcome-text">Dear <strong>${booking.fullName}</strong>,</p>
            <p class="welcome-text">Thank you for choosing DySi Tours. Your tour bus booking has been successfully confirmed. Below are your travel details:</p>
            
            <div class="booking-card">
              <h2>Travel Itinerary</h2>
              <div class="detail-row">
                <div class="detail-label">Tour Package:</div>
                <div class="detail-value">${booking.packageName}</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">Bus Type:</div>
                <div class="detail-value">${booking.busType}</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">Passengers:</div>
                <div class="detail-value">${booking.passengers}</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">Selected Seats:</div>
                <div class="detail-value">${booking.selectedSeats.join(', ')}</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">Pickup Location:</div>
                <div class="detail-value">${booking.pickupLocation}</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">Drop Location:</div>
                <div class="detail-value">${booking.dropLocation}</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">Travel Date:</div>
                <div class="detail-value">${travelDate}</div>
              </div>
              ${
                returnDate
                  ? `
              <div class="detail-row">
                <div class="detail-label">Return Date:</div>
                <div class="detail-value">${returnDate}</div>
              </div>
              `
                  : ''
              }
              <div class="detail-row fare-row">
                <div class="detail-label">Total Fare Paid:</div>
                <div class="detail-value">₹${booking.totalFare}</div>
              </div>
            </div>
            
            <p class="welcome-text" style="text-align: center; color: #64748b;">If you need to make changes to your booking, please reply to this email or contact support.</p>
          </div>
          <div class="footer">
            <p><strong>DySi Tours & Travels</strong></p>
            <p>Bengaluru, Karnataka, India</p>
            <p>&copy; 2026 DySi. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateSMSBody(booking: Booking): string {
    const travelDate = new Date(booking.travelDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return `DySi Booking Confirmed! Ticket: ${booking.bookingId}. Passenger: ${booking.fullName}. Tour: ${booking.packageName}. Seats: ${booking.selectedSeats.join(', ')}. Date: ${travelDate}. Total Paid: Rs ${booking.totalFare}. Safe travels!`;
  }
}
