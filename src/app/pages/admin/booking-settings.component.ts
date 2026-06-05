import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { FirestoreService } from '../../core/services/firestore.service';
import {
  BookingFieldConfig,
  BookingSettingsConfig,
  defaultBookingFields,
} from '../../core/models/booking.models';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';

interface SeatingRow {
  rowLetter: string;
  leftSeats: string[];
  rightSeats: string[];
}

@Component({
  standalone: true,
  selector: 'app-booking-settings',
  templateUrl: './booking-settings.component.html',
  styleUrls: ['./booking-settings.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ToastModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    TextareaModule,
  ],
  providers: [MessageService],
})
export class BookingSettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly firestoreService = inject(FirestoreService);
  private readonly messageService = inject(MessageService);

  // Accordion Sections State
  openSection = signal<string>('fields');

  // Booking Settings signal
  settings = signal<BookingSettingsConfig>({
    fields: [],
    seatLayout: {
      layoutType: '2+2',
      totalSeats: 20,
      driverPosition: 'left',
      entrancePosition: 'right',
    },
  });

  // Dynamic Fields
  fieldsList = computed(() => this.settings().fields);

  // Field Types
  fieldTypes = [
    { label: 'Textbox', value: 'textbox' },
    { label: 'Number', value: 'number' },
    { label: 'Dropdown', value: 'dropdown' },
    { label: 'Checkbox', value: 'checkbox' },
    { label: 'Radio button', value: 'radio' },
    { label: 'Date picker', value: 'datepicker' },
    { label: 'Textarea', value: 'textarea' },
  ];

  // Forms
  customFieldForm = this.fb.group({
    label: ['', Validators.required],
    placeholder: [''],
    type: ['textbox', Validators.required],
    required: [false],
    options: [''], // Comma-separated initial options
  });

  editingField: BookingFieldConfig | null = null;
  editFieldForm = this.fb.group({
    label: ['', Validators.required],
    placeholder: [''],
    required: [false],
  });

  // Dropdown Management State
  selectedDropdownFieldKey = signal<string>('');
  newOptionVal = signal<string>('');
  editingOptionIndex = signal<number | null>(null);
  editingOptionVal = signal<string>('');

  // Drag and drop state
  draggedIndex: number | null = null;

  // Options for Dropdown Manager select
  dropdownFields = computed(() => {
    return this.settings().fields.filter((f) => f.type === 'dropdown' || f.type === 'radio');
  });

  selectedDropdownField = computed(() => {
    return this.settings().fields.find((f) => f.key === this.selectedDropdownFieldKey());
  });

  // Seat layout computed logic for Live Preview
  leftColCount = computed(() => (this.settings().seatLayout?.layoutType === '3+2' ? 3 : 2));
  rightColCount = signal<number>(2);

  previewSeats = computed(() => {
    const layout = this.settings().seatLayout;
    if (!layout) return [];
    const total = layout.totalSeats || 20;
    const seatsPerRow = this.leftColCount() + this.rightColCount();
    const rowCount = Math.ceil(total / seatsPerRow);

    const rows: SeatingRow[] = [];
    for (let r = 0; r < rowCount; r++) {
      const rowLetter = String.fromCharCode(65 + r);
      const leftSeats: string[] = [];
      const rightSeats: string[] = [];

      // Left
      for (let c = 0; c < this.leftColCount(); c++) {
        if (r * seatsPerRow + c < total) {
          leftSeats.push(`${rowLetter}${c + 1}`);
        }
      }

      // Right
      for (let c = 0; c < this.rightColCount(); c++) {
        if (r * seatsPerRow + this.leftColCount() + c < total) {
          rightSeats.push(`${rowLetter}${this.leftColCount() + c + 1}`);
        }
      }

      rows.push({ rowLetter, leftSeats, rightSeats });
    }
    return rows;
  });

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.firestoreService.getBookingSettings().subscribe({
      next: (data) => {
        if (data && data.fields && data.fields.length > 0) {
          this.settings.set(data);
          if (this.dropdownFields().length > 0) {
            this.selectedDropdownFieldKey.set(this.dropdownFields()[0].key);
          }
        } else {
          // Setup defaults
          const defaults: BookingSettingsConfig = {
            fields: [...defaultBookingFields],
            seatLayout: {
              layoutType: '2+2',
              totalSeats: 20,
              driverPosition: 'left',
              entrancePosition: 'right',
            },
          };
          this.settings.set(defaults);
          if (this.dropdownFields().length > 0) {
            this.selectedDropdownFieldKey.set(this.dropdownFields()[0].key);
          }
        }
      },
      error: (err) => {
        console.error('Error fetching settings:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Load Failed',
          detail: 'Could not retrieve settings from Firestore.',
        });
      },
    });
  }

  async saveSettings(): Promise<void> {
    try {
      await this.firestoreService.saveBookingSettings(this.settings());
      this.messageService.add({
        severity: 'success',
        summary: 'Settings Saved',
        detail: 'Booking configuration has been saved successfully.',
      });
    } catch (err) {
      console.error('Save failed:', err);
      this.messageService.add({
        severity: 'error',
        summary: 'Save Failed',
        detail: 'Could not store settings in database.',
      });
    }
  }

  toggleSection(section: string): void {
    this.openSection.update((current) => (current === section ? '' : section));
  }

  // Core fields validation check
  isCoreField(key: string): boolean {
    const coreKeys = [
      'fullName',
      'mobileNumber',
      'email',
      'aadhaarNumber',
      'pickupLocation',
      'dropLocation',
      'address',
      'passengers',
      'travelDate',
      'returnDate',
      'busType',
      'packageName',
      'paymentMethod',
      'specialRequests',
    ];
    return coreKeys.includes(key);
  }

  // Fields Management Actions
  toggleFieldVisibility(field: BookingFieldConfig): void {
    const updatedFields = this.settings().fields.map((f) =>
      f.key === field.key ? { ...f, visible: !f.visible } : f,
    );
    this.updateFields(updatedFields);
  }

  toggleFieldRequired(field: BookingFieldConfig): void {
    const updatedFields = this.settings().fields.map((f) =>
      f.key === field.key ? { ...f, required: !f.required } : f,
    );
    this.updateFields(updatedFields);
  }

  startEditField(field: BookingFieldConfig): void {
    this.editingField = field;
    this.editFieldForm.setValue({
      label: field.label,
      placeholder: field.placeholder || '',
      required: field.required,
    });
  }

  cancelEditField(): void {
    this.editingField = null;
    this.editFieldForm.reset();
  }

  saveFieldEdit(): void {
    if (this.editFieldForm.invalid || !this.editingField) return;

    const formVal = this.editFieldForm.value;
    const updatedFields = this.settings().fields.map((f) =>
      f.key === this.editingField!.key
        ? {
            ...f,
            label: formVal.label || f.label,
            placeholder: formVal.placeholder || '',
            required: !!formVal.required,
          }
        : f,
    );

    this.updateFields(updatedFields);
    this.cancelEditField();
    this.messageService.add({
      severity: 'info',
      summary: 'Field Updated',
      detail: 'Label/Placeholder updated in list.',
    });
  }

  deleteField(field: BookingFieldConfig): void {
    if (this.isCoreField(field.key)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Protected Field',
        detail: 'Core fields cannot be deleted.',
      });
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete custom field "${field.label}"?`);
    if (!confirmed) return;

    const updatedFields = this.settings().fields.filter((f) => f.key !== field.key);
    this.updateFields(updatedFields);
    this.messageService.add({
      severity: 'info',
      summary: 'Field Removed',
      detail: 'Custom field deleted successfully.',
    });
  }

  addField(): void {
    if (this.customFieldForm.invalid) return;

    const formVal = this.customFieldForm.value;
    // Generate simple unique key
    const customKey = 'custom_' + Date.now().toString(36);

    // Parse options if provided
    let optionsList: string[] | undefined = undefined;
    if (formVal.options && (formVal.type === 'dropdown' || formVal.type === 'radio')) {
      optionsList = formVal.options
        .split(',')
        .map((opt) => opt.trim())
        .filter(Boolean);
    }

    const newField: BookingFieldConfig = {
      key: customKey,
      label: formVal.label!,
      placeholder: formVal.placeholder || '',
      type: formVal.type as any,
      required: !!formVal.required,
      visible: true,
      options: optionsList,
      colSpan: formVal.type === 'textarea' ? 6 : 3,
    };

    const updatedFields = [...this.settings().fields, newField];
    this.updateFields(updatedFields);

    // Reset Form
    this.customFieldForm.reset({
      label: '',
      placeholder: '',
      type: 'textbox',
      required: false,
      options: '',
    });

    this.messageService.add({
      severity: 'success',
      summary: 'Field Added',
      detail: `Successfully added custom field "${newField.label}".`,
    });

    // Auto set dropdown key if this is a new dropdown/radio
    if (newField.type === 'dropdown' || newField.type === 'radio') {
      this.selectedDropdownFieldKey.set(newField.key);
    }
  }

  // Field list order modifiers
  moveFieldUp(index: number): void {
    if (index === 0) return;
    const list = [...this.settings().fields];
    const temp = list[index];
    list[index] = list[index - 1];
    list[index - 1] = temp;
    this.updateFields(list);
  }

  moveFieldDown(index: number): void {
    if (index === this.settings().fields.length - 1) return;
    const list = [...this.settings().fields];
    const temp = list[index];
    list[index] = list[index + 1];
    list[index + 1] = temp;
    this.updateFields(list);
  }

  // Drag and Drop (HTML5 Native)
  onDragStart(index: number): void {
    this.draggedIndex = index;
  }

  onDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent, index: number): void {
    event.preventDefault();
    if (this.draggedIndex !== null && this.draggedIndex !== index) {
      const list = [...this.settings().fields];
      const draggedItem = list[this.draggedIndex];
      list.splice(this.draggedIndex, 1);
      list.splice(index, 0, draggedItem);
      this.updateFields(list);
    }
    this.draggedIndex = null;
  }

  private updateFields(fields: BookingFieldConfig[]): void {
    this.settings.update((current) => ({
      ...current,
      fields,
    }));
  }

  // Dropdown options management
  addOption(): void {
    const val = this.newOptionVal().trim();
    if (!val || !this.selectedDropdownFieldKey()) return;

    const currentField = this.selectedDropdownField();
    if (!currentField) return;

    // Prevent core fields from losing standard options if we want, or allow edit
    const currentOptions = currentField.options || [];
    if (currentOptions.includes(val)) {
      this.messageService.add({ severity: 'warn', summary: 'Duplicate Option', detail: 'This option already exists.' });
      return;
    }

    const updatedFields = this.settings().fields.map((f) => {
      if (f.key === this.selectedDropdownFieldKey()) {
        return {
          ...f,
          options: [...currentOptions, val],
        };
      }
      return f;
    });

    this.updateFields(updatedFields);
    this.newOptionVal.set('');
    this.messageService.add({ severity: 'success', summary: 'Option Added', detail: `Added option "${val}"` });
  }

  startEditOption(index: number, val: string): void {
    this.editingOptionIndex.set(index);
    this.editingOptionVal.set(val);
  }

  cancelEditOption(): void {
    this.editingOptionIndex.set(null);
    this.editingOptionVal.set('');
  }

  saveOptionEdit(): void {
    const idx = this.editingOptionIndex();
    const val = this.editingOptionVal().trim();
    if (idx === null || !val) return;

    const currentField = this.selectedDropdownField();
    if (!currentField) return;

    const currentOptions = [...(currentField.options || [])];
    currentOptions[idx] = val;

    const updatedFields = this.settings().fields.map((f) => {
      if (f.key === this.selectedDropdownFieldKey()) {
        return {
          ...f,
          options: currentOptions,
        };
      }
      return f;
    });

    this.updateFields(updatedFields);
    this.cancelEditOption();
    this.messageService.add({ severity: 'info', summary: 'Option Updated', detail: 'Dropdown value modified.' });
  }

  deleteOption(index: number): void {
    const currentField = this.selectedDropdownField();
    if (!currentField || !currentField.options) return;

    const val = currentField.options[index];
    const confirmed = window.confirm(`Remove option "${val}"?`);
    if (!confirmed) return;

    const updatedOptions = currentField.options.filter((_, idx) => idx !== index);

    const updatedFields = this.settings().fields.map((f) => {
      if (f.key === this.selectedDropdownFieldKey()) {
        return {
          ...f,
          options: updatedOptions,
        };
      }
      return f;
    });

    this.updateFields(updatedFields);
    this.messageService.add({ severity: 'info', summary: 'Option Removed', detail: 'Dropdown option deleted.' });
  }

  moveOption(index: number, direction: 'up' | 'down'): void {
    const currentField = this.selectedDropdownField();
    if (!currentField || !currentField.options) return;

    const options = [...currentField.options];
    if (direction === 'up' && index > 0) {
      const temp = options[index];
      options[index] = options[index - 1];
      options[index - 1] = temp;
    } else if (direction === 'down' && index < options.length - 1) {
      const temp = options[index];
      options[index] = options[index + 1];
      options[index + 1] = temp;
    } else {
      return;
    }

    const updatedFields = this.settings().fields.map((f) => {
      if (f.key === this.selectedDropdownFieldKey()) {
        return {
          ...f,
          options,
        };
      }
      return f;
    });

    this.updateFields(updatedFields);
  }

  // Seat Layout configuration actions
  changeLayout(layoutType: '2+2' | '3+2'): void {
    this.settings.update((current) => ({
      ...current,
      seatLayout: {
        ...current.seatLayout,
        layoutType,
      },
    }));
    this.messageService.add({ severity: 'info', summary: 'Layout Changed', detail: `Switched to ${layoutType} bus seating arrangement.` });
  }

  setTotalSeats(totalSeats: number): void {
    if (totalSeats < 4 || totalSeats > 60) return;
    this.settings.update((current) => ({
      ...current,
      seatLayout: {
        ...current.seatLayout,
        totalSeats,
      },
    }));
  }

  toggleDriverPosition(): void {
    const newPos = this.settings().seatLayout.driverPosition === 'left' ? 'right' : 'left';
    this.settings.update((current) => ({
      ...current,
      seatLayout: {
        ...current.seatLayout,
        driverPosition: newPos,
      },
    }));
  }

  toggleEntrancePosition(): void {
    const newPos = this.settings().seatLayout.entrancePosition === 'left' ? 'right' : 'left';
    this.settings.update((current) => ({
      ...current,
      seatLayout: {
        ...current.seatLayout,
        entrancePosition: newPos,
      },
    }));
  }

  // Helper for layout spacers
  getSpacers(seats: string[], targetCount: number): any[] {
    const diff = targetCount - seats.length;
    return diff > 0 ? new Array(diff) : [];
  }
}
