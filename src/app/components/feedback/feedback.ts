import { Component } from '@angular/core';

@Component({
  selector: 'app-feedback',
  templateUrl: './feedback.html',
  styleUrl: './feedback.scss',
})
export class FeedbackComponent {
  readonly feedback = [
    {
      name: 'Rhea Kapoor',
      company: 'BrightOps',
      text: 'DySi helped us replace a slow internal workflow with a polished portal our team enjoys using every day.',
      image: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=300&q=80',
    },
    {
      name: 'Daniel Brooks',
      company: 'Northstar Labs',
      text: 'The launch was smooth, but the real win was how clearly they translated product strategy into engineering.',
      image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80',
    },
    {
      name: 'Priya Nair',
      company: 'ScaleBridge',
      text: 'Clean design, thoughtful delivery, and practical advice. They felt like an extension of our own team.',
      image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=300&q=80',
    },
  ];
}
