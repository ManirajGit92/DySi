import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-services-page',
  imports: [RouterLink],
  templateUrl: './services-page.html',
  styleUrl: './services-page.scss',
})
export class ServicesPageComponent {
  readonly serviceGroups = [
    {
      icon: 'fa-compass-drafting',
      title: 'Strategy and Discovery',
      items: ['Product roadmap', 'UX audits', 'Technical planning'],
    },
    {
      icon: 'fa-laptop-code',
      title: 'Application Engineering',
      items: ['Angular frontends', 'API integrations', 'Cloud deployments'],
    },
    {
      icon: 'fa-database',
      title: 'Data and Automation',
      items: ['Dashboards', 'CRM workflows', 'Reporting systems'],
    },
    {
      icon: 'fa-life-ring',
      title: 'Optimization Support',
      items: ['Performance tuning', 'Release management', 'Monitoring'],
    },
  ];
}
