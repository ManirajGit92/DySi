import { Injectable, inject } from '@angular/core';
import { Auth, signInAnonymously } from '@angular/fire/auth';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  getDocs,
  doc,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable, catchError, map, of } from 'rxjs';
import { FeedbackQuestion, FeedbackResponse } from '../models/feedback.models';

@Injectable({
  providedIn: 'root',
})
export class FeedbackService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);

  /**
   * Fetches all feedback questions sorted by order index.
   */
  getQuestions(): Observable<FeedbackQuestion[]> {
    const colRef = collection(this.firestore, 'feedback_questions');
    const q = query(colRef, orderBy('order', 'asc'));
    return collectionData(q, { idField: 'id' }).pipe(
      map((items) => items as FeedbackQuestion[]),
      catchError((err) => {
        console.error('Error fetching feedback questions', err);
        return of([]);
      }),
    );
  }

  /**
   * Creates or updates a feedback question.
   */
  async saveQuestion(question: FeedbackQuestion): Promise<void> {
    const colRef = collection(this.firestore, 'feedback_questions');
    const id = question.id || crypto.randomUUID();
    const cleanQuestion = {
      ...question,
      id,
      order: Number(question.order) || 0,
      options: question.options || [],
      allowCustomText: Boolean(question.allowCustomText),
      required: Boolean(question.required),
    };
    await setDoc(doc(this.firestore, 'feedback_questions', id), cleanQuestion, { merge: true });
  }

  /**
   * Deletes a question from Firestore.
   */
  async deleteQuestion(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'feedback_questions', id));
  }

  /**
   * Ensures the user has a Firebase auth session.
   * Returns both uid and email — real email for logged-in users,
   * 'anonymous' label for anonymous/guest sessions.
   */
  async ensureAuthenticatedUser(): Promise<{ uid: string; email: string }> {
    const currentUser = this.auth.currentUser;
    if (currentUser) {
      return {
        uid: currentUser.uid,
        email: currentUser.email || 'anonymous',
      };
    }
    // Sign in anonymously for guest users
    try {
      const credential = await signInAnonymously(this.auth);
      return {
        uid: credential.user.uid,
        email: 'anonymous',
      };
    } catch (err) {
      console.error('Anonymous auth failed, fallback to session UUID', err);
      const fallbackId = 'anonymous-' + crypto.randomUUID();
      return { uid: fallbackId, email: 'anonymous' };
    }
  }

  /**
   * Submits feedback responses to Firestore.
   */
  async submitResponse(response: Omit<FeedbackResponse, 'timestamp'>): Promise<void> {
    const colRef = collection(this.firestore, 'feedback_responses');
    await addDoc(colRef, {
      ...response,
      timestamp: serverTimestamp(),
    });
  }

  /**
   * Fetches all responses in real-time.
   */
  getResponses(): Observable<FeedbackResponse[]> {
    const colRef = collection(this.firestore, 'feedback_responses');
    const q = query(colRef, orderBy('timestamp', 'desc'));
    return collectionData(q, { idField: 'id' }).pipe(
      map((items) => items as FeedbackResponse[]),
      catchError((err) => {
        console.error('Error fetching responses', err);
        return of([]);
      }),
    );
  }

  /**
   * Deletes all feedback questions documents. Use with caution.
   */
  async clearAllQuestions(): Promise<void> {
    try {
      const colRef = collection(this.firestore, 'feedback_questions');
      const snaps = await getDocs(colRef);
      const deletions: Promise<void>[] = [];
      snaps.forEach((s) =>
        deletions.push(deleteDoc(doc(this.firestore, 'feedback_questions', s.id))),
      );
      await Promise.all(deletions);
    } catch (err) {
      console.error('Failed to clear questions', err);
      throw err;
    }
  }

  /**
   * Deletes all feedback responses documents. Use with caution.
   */
  async clearAllResponses(): Promise<void> {
    try {
      const colRef = collection(this.firestore, 'feedback_responses');
      const snaps = await getDocs(colRef);
      const deletions: Promise<void>[] = [];
      snaps.forEach((s) =>
        deletions.push(deleteDoc(doc(this.firestore, 'feedback_responses', s.id))),
      );
      await Promise.all(deletions);
    } catch (err) {
      console.error('Failed to clear responses', err);
      throw err;
    }
  }
}
