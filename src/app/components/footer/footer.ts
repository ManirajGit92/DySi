import { Component, EventEmitter, Input, Output } from '@angular/core';

import { FooterSettings, MenuItem } from '../../core/models/website.models';
import { defaultFooterSettings } from '../../core/services/website-data.service';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class FooterComponent {
  @Output() sectionSelected = new EventEmitter<string>();
  @Input() menus: MenuItem[] = [];
  settings: FooterSettings = defaultFooterSettings;

  @Input() set footerSettings(value: FooterSettings | null) {
    this.settings = value ?? defaultFooterSettings;
  }
}
