import { Timestamp } from '@angular/fire/firestore';

export type QuestionType = 'radio' | 'checkbox' | 'dropdown' | 'textarea' | 'text';

export interface FeedbackQuestion {
  id?: string;
  text: string;
  type: QuestionType;
  required: boolean;
  order: number;
  options?: string[]; // list of answers for radio, checkbox, dropdown
  allowCustomText?: boolean; // enable free text response
  createdAt?: Date | Timestamp;
}

export interface FeedbackResponse {
  id?: string;
  userId: string;
  userEmail: string; // authenticated user email or 'anonymous' for guests
  answers: {
    questionId: string;
    questionText: string;
    selectedAnswers?: string[]; // checked options or selected radio
    textAnswer?: string; // free text answer
  }[];
  timestamp: Date | Timestamp;
}
