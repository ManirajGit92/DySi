import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FeedbackQuestion } from '../../core/models/feedback.models';
import { FeedbackService } from '../../core/services/feedback.service';

@Component({
  selector: 'app-feedback-submission',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './feedback-submission.html',
  styleUrl: './feedback-submission.scss'
})
export class FeedbackSubmissionComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly feedbackService = inject(FeedbackService);

  readonly questions = signal<FeedbackQuestion[]>([]);
  readonly isLoading = signal(true);
  readonly isSubmitted = signal(false);
  readonly submissionError = signal('');
  readonly isSubmitting = signal(false);

  feedbackForm!: FormGroup;

  ngOnInit(): void {
    this.loadQuestions();
  }

  private loadQuestions(): void {
    this.feedbackService.getQuestions().subscribe({
      next: (qList) => {
        this.questions.set(qList);
        this.buildForm(qList);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.submissionError.set('Unable to load questions. Please try again.');
        this.isLoading.set(false);
      }
    });
  }

  private buildForm(qList: FeedbackQuestion[]): void {
    const group: Record<string, any> = {};

    qList.forEach((q) => {
      if (!q.id) return;
      
      const validators = q.required ? [Validators.required] : [];

      if (q.type === 'checkbox') {
        // For checkboxes, we can store selected options as an array.
        // We'll initialize it as an empty array control, or a group of booleans if needed.
        // Let's store it as a FormArray or simple FormControl holding an array of strings.
        // Storing an array of strings is much cleaner for reactive binding with custom checkboxes.
        group[q.id] = new FormControl([], validators);
      } else {
        group[q.id] = new FormControl('', validators);
      }

      // Add helper control for free text response if allowed
      if (q.allowCustomText) {
        group[q.id + '_customText'] = new FormControl('');
      }
    });

    this.feedbackForm = this.fb.group(group);
  }

  /**
   * Helper to handle checkbox selections.
   */
  onCheckboxChange(questionId: string, option: string, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const control = this.feedbackForm.get(questionId) as FormControl;
    const currentValues: string[] = [...(control.value || [])];

    if (checkbox.checked) {
      if (!currentValues.includes(option)) {
        currentValues.push(option);
      }
    } else {
      const idx = currentValues.indexOf(option);
      if (idx > -1) {
        currentValues.splice(idx, 1);
      }
    }

    control.setValue(currentValues);
    control.markAsDirty();
    control.markAsTouched();
  }

  /**
   * Checks if an option is selected for a given questionId.
   */
  isOptionChecked(questionId: string, option: string): boolean {
    const control = this.feedbackForm.get(questionId);
    return control ? (control.value || []).includes(option) : false;
  }

  async onSubmit(): Promise<void> {
    if (this.feedbackForm.invalid) {
      this.feedbackForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.submissionError.set('');

    try {
      // 1. Ensure user has a secure auth session — get both uid and email
      const { uid, email } = await this.feedbackService.ensureAuthenticatedUser();

      // 2. Map form controls to our dynamic response schema
      const answers = this.questions().map((q) => {
        const qId = q.id!;
        const val = this.feedbackForm.value[qId];
        const customText = q.allowCustomText ? this.feedbackForm.value[qId + '_customText'] || '' : '';

        const selectedAnswers: string[] = [];
        let textAnswer = '';

        if (q.type === 'checkbox') {
          selectedAnswers.push(...(val || []));
        } else if (q.type === 'radio' || q.type === 'dropdown') {
          if (val) selectedAnswers.push(val);
        } else {
          textAnswer = val || '';
        }

        // Include any additional free text responses
        if (customText) {
          textAnswer = textAnswer ? `${textAnswer} (Custom text: ${customText})` : customText;
        }

        return {
          questionId: qId,
          questionText: q.text,
          selectedAnswers,
          textAnswer
        };
      });

      // 3. Submit response doc with uid and email
      await this.feedbackService.submitResponse({
        userId: uid,
        userEmail: email,
        answers
      });

      this.isSubmitted.set(true);
    } catch (err) {
      console.error(err);
      this.submissionError.set('Failed to submit feedback. Please try again.');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
