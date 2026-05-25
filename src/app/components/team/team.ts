import { Component } from '@angular/core';

@Component({
  selector: 'app-team',
  templateUrl: './team.html',
  styleUrl: './team.scss',
})
export class TeamComponent {
  readonly members = [
    {
      name: 'Aarav Mehta',
      role: 'Product Strategist',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=80',
    },
    {
      name: 'Nisha Rao',
      role: 'UX Design Lead',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=80',
    },
    {
      name: 'Kabir Sethi',
      role: 'Cloud Architect',
      image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=500&q=80',
    },
    {
      name: 'Maya Iyer',
      role: 'Growth Analyst',
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=500&q=80',
    },
  ];
}
