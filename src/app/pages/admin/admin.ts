import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TabsModule } from 'primeng/tabs';
import { Settings } from '../settings/settings';
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, TabsModule, Settings],
  templateUrl: './admin.html',
  styleUrls: ['./admin.scss'],
})
export class AdminComponent {
  activeTab: string = 'dashboard';
  isDarkTheme: boolean = true;

  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;
  }
  constructor() {}
}
