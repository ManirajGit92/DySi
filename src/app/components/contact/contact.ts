import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-contact',
  imports: [FormsModule],
  templateUrl: './contact.html',
  styleUrl: './contact.scss',
})
export class ContactComponent {
  readonly formStatus = signal('');

  submitForm(): void {
    this.formStatus.set('Thanks. Your message is ready for the DySi team.');
  }
}
