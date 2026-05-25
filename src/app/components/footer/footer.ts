import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class FooterComponent {
  @Output() sectionSelected = new EventEmitter<string>();

  readonly links = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About Us' },
    { id: 'services', label: 'Services' },
    { id: 'team', label: 'Team' },
    { id: 'feedback', label: 'Feedback' },
    { id: 'contact', label: 'Contact Us' },
  ];
}
