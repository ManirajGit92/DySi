import { Component } from '@angular/core';

@Component({
  selector: 'app-about',
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class AboutComponent {
  readonly highlights = [
    { icon: 'fa-bullseye', title: 'Mission', text: 'Turn complex business goals into reliable digital products.' },
    { icon: 'fa-eye', title: 'Vision', text: 'Make modern software accessible, useful, and beautifully simple.' },
    { icon: 'fa-handshake', title: 'Values', text: 'Partnership, clarity, measurable outcomes, and long-term care.' },
  ];
}
