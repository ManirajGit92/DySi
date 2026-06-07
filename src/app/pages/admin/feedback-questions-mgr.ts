import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, inject } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { FeedbackQuestion, QuestionType } from '../../core/models/feedback.models';
import { FeedbackService } from '../../core/services/feedback.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-feedback-questions-mgr',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ConfirmDialogComponent],
  templateUrl: './feedback-questions-mgr.html',
  styleUrl: './feedback-questions-mgr.scss',
})
export class FeedbackQuestionsMgrComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly feedbackService = inject(FeedbackService);

  readonly questionsList = signal<FeedbackQuestion[]>([]);
  readonly isLoading = signal(true);
  readonly status = signal('');
  readonly editingQuestionId = signal<string | null>(null);

  // Confirmation dialog state
  readonly confirmOpen = signal(false);
  readonly confirmTitle = signal('');
  readonly confirmMessage = signal('');
  readonly confirmSub = signal('');
  readonly confirmProcessing = signal(false);
  private pendingConfirmAction: (() => Promise<void>) | null = null;

  questionForm!: FormGroup;

  get optionsFormArray(): FormArray {
    return this.questionForm.get('options') as FormArray;
  }

  ngOnInit(): void {
    this.initForm();
    this.loadQuestions();
  }

  private initForm(): void {
    this.questionForm = this.fb.group({
      text: ['', Validators.required],
      type: ['text' as QuestionType, Validators.required],
      required: [false],
      order: [1, [Validators.required, Validators.min(0)]],
      allowCustomText: [false],
      options: this.fb.array([]),
    });

    // Listen to type changes: if it's text or textarea, clean out the options array.
    this.questionForm.get('type')?.valueChanges.subscribe((type) => {
      if (type === 'text' || type === 'textarea') {
        this.clearOptions();
      } else if (this.optionsFormArray.length === 0) {
        // Add a default option if multiple choice is selected
        this.addOption();
      }
    });
  }

  private loadQuestions(): void {
    this.feedbackService.getQuestions().subscribe({
      next: (list) => {
        this.questionsList.set(list);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.status.set('Failed to load questions.');
        this.isLoading.set(false);
      },
    });
  }

  addOption(value = ''): void {
    this.optionsFormArray.push(this.fb.control(value, Validators.required));
  }

  removeOption(index: number): void {
    this.optionsFormArray.removeAt(index);
  }

  clearOptions(): void {
    while (this.optionsFormArray.length !== 0) {
      this.optionsFormArray.removeAt(0);
    }
  }

  editQuestion(q: FeedbackQuestion): void {
    this.editingQuestionId.set(q.id || null);

    // Clear out options FormArray first
    this.clearOptions();

    // Patch form fields
    this.questionForm.patchValue({
      text: q.text,
      type: q.type,
      required: q.required,
      order: q.order,
      allowCustomText: q.allowCustomText || false,
    });

    // Load options into FormArray
    if (q.options && q.options.length > 0) {
      q.options.forEach((opt) => this.addOption(opt));
    }
  }

  resetForm(): void {
    this.editingQuestionId.set(null);
    this.questionForm.reset({
      text: '',
      type: 'text' as QuestionType,
      required: false,
      order: this.questionsList().length + 1 || 1,
      allowCustomText: false,
    });
    this.clearOptions();
  }

  async saveQuestion(): Promise<void> {
    if (this.questionForm.invalid) {
      this.questionForm.markAllAsTouched();
      return;
    }

    this.status.set('Saving...');

    const val = this.questionForm.value;
    const model: FeedbackQuestion = {
      id: this.editingQuestionId() || undefined,
      text: val.text,
      type: val.type,
      required: val.required,
      order: Number(val.order) || 0,
      allowCustomText: val.allowCustomText || false,
      options: val.options || [],
    };

    try {
      await this.feedbackService.saveQuestion(model);
      this.status.set('Question saved successfully!');
      this.resetForm();
      setTimeout(() => this.status.set(''), 3000);
    } catch (err) {
      console.error(err);
      this.status.set('Failed to save question.');
    }
  }

  async deleteQuestion(id: string): Promise<void> {
    // Open confirmation dialog for single-delete
    this.confirmTitle.set('Delete question?');
    this.confirmMessage.set('This will permanently remove the selected question from the survey.');
    this.confirmSub.set('This action cannot be undone. Related responses may become orphaned.');
    this.pendingConfirmAction = async () => {
      this.confirmProcessing.set(true);
      this.status.set('Deleting...');
      try {
        await this.feedbackService.deleteQuestion(id);
        this.status.set('Question deleted.');
        if (this.editingQuestionId() === id) this.resetForm();
      } catch (err) {
        console.error(err);
        this.status.set('Failed to delete question.');
      } finally {
        this.confirmProcessing.set(false);
        this.confirmOpen.set(false);
        setTimeout(() => this.status.set(''), 3000);
      }
    };
    this.confirmOpen.set(true);
  }

  // Clear all questions and responses
  clearAllData(): void {
    this.confirmTitle.set('Clear all feedback data?');
    this.confirmMessage.set(
      'This will permanently delete all feedback questions and all submitted answers.',
    );
    this.confirmSub.set('This action cannot be undone. Consider exporting data first.');
    this.pendingConfirmAction = async () => {
      this.confirmProcessing.set(true);
      this.status.set('Clearing data...');
      try {
        await this.feedbackService.clearAllQuestions();
        await this.feedbackService.clearAllResponses();
        this.status.set('All feedback data cleared.');
        this.resetForm();
      } catch (err) {
        console.error(err);
        this.status.set('Failed to clear feedback data.');
      } finally {
        this.confirmProcessing.set(false);
        this.confirmOpen.set(false);
        setTimeout(() => this.status.set(''), 3000);
      }
    };
    this.confirmOpen.set(true);
  }

  // Called by confirm dialog when confirmed
  async onConfirmed(): Promise<void> {
    if (this.pendingConfirmAction) {
      await this.pendingConfirmAction();
      this.pendingConfirmAction = null;
    }
  }

  onCancelled(): void {
    this.pendingConfirmAction = null;
    this.confirmOpen.set(false);
  }
}
