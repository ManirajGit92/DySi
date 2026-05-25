import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-services',
  imports: [RouterLink],
  templateUrl: './services.html',
  styleUrl: './services.scss',
})
export class ServicesComponent {
  readonly services = [
    {
      icon: 'fa-code',
      title: 'Web App Development',
      text: 'Responsive Angular, API, and cloud products built for speed and scale.',
    },
    {
      icon: 'fa-chart-line',
      title: 'Growth Analytics',
      text: 'Dashboards and experiments that reveal what customers do next.',
    },
    {
      icon: 'fa-shield-halved',
      title: 'Cloud Architecture',
      text: 'Secure infrastructure, deployment pipelines, and reliability planning.',
    },
    {
      icon: 'fa-wand-magic-sparkles',
      title: 'UX Modernization',
      text: 'Sharper journeys, cleaner interfaces, and conversion-focused redesigns.',
    },
    {
      icon: 'fa-robot',
      title: 'Automation',
      text: 'Workflow systems that remove repetitive operations from busy teams.',
    },
    {
      icon: 'fa-headset',
      title: 'Managed Support',
      text: 'Ongoing improvements, monitoring, releases, and technical guidance.',
    },
  ];
}
