import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Auth,
  authState,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from '@angular/fire/auth';
import { FirestoreService, Todo } from './services/firestore.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly title = signal('Firestore CRUD App');
  todos = signal<Todo[]>([]);
  newTodoTitle = signal('');
  newTodoDescription = signal('');
  editingId = signal<string | null>(null);
  editTitle = signal('');
  editDescription = signal('');
  isLoading = signal(false);
  errorMessage = signal('');
  user = signal<User | null>(null);

  constructor(
    private firestoreService: FirestoreService,
    private auth: Auth,
  ) {
    authState(this.auth).subscribe((user) => {
      this.user.set(user);
      if (user) {
        this.loadTodos().catch((error) => {
          console.error(error);
        });
      } else {
        this.todos.set([]);
      }
    });
  }

  async ngOnInit() {
    // Keep the app ready; auth state subscription will load data when signed in.
  }

  async loadTodos() {
    if (!this.user()) {
      this.todos.set([]);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      const todos = await this.firestoreService.getAllTodos();
      this.todos.set(todos);
    } catch (error) {
      this.errorMessage.set('Error loading todos');
      console.error(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async signInWithGoogle() {
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      await signInWithPopup(this.auth, new GoogleAuthProvider());
    } catch (error) {
      this.errorMessage.set('Google sign-in failed');
      console.error(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async signOut() {
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      await signOut(this.auth);
    } catch (error) {
      this.errorMessage.set('Sign-out failed');
      console.error(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async addTodo() {
    if (!this.newTodoTitle().trim()) {
      this.errorMessage.set('Title is required');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      const newTodo: Todo = {
        title: this.newTodoTitle(),
        description: this.newTodoDescription(),
        completed: false,
      };
      await this.firestoreService.addTodo(newTodo);
      this.newTodoTitle.set('');
      this.newTodoDescription.set('');
      await this.loadTodos();
    } catch (error) {
      this.errorMessage.set('Error adding todo');
      console.error(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async toggleTodo(todo: Todo) {
    this.isLoading.set(true);
    try {
      await this.firestoreService.updateTodo(todo.id!, {
        completed: !todo.completed,
      });
      await this.loadTodos();
    } catch (error) {
      this.errorMessage.set('Error updating todo');
      console.error(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  startEditing(todo: Todo) {
    this.editingId.set(todo.id!);
    this.editTitle.set(todo.title);
    this.editDescription.set(todo.description);
  }

  async saveTodo() {
    if (!this.editTitle().trim()) {
      this.errorMessage.set('Title is required');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      await this.firestoreService.updateTodo(this.editingId()!, {
        title: this.editTitle(),
        description: this.editDescription(),
      });
      this.editingId.set(null);
      this.editTitle.set('');
      this.editDescription.set('');
      await this.loadTodos();
    } catch (error) {
      this.errorMessage.set('Error updating todo');
      console.error(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  cancelEditing() {
    this.editingId.set(null);
    this.editTitle.set('');
    this.editDescription.set('');
  }

  async deleteTodo(id: string) {
    if (!confirm('Are you sure you want to delete this todo?')) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      await this.firestoreService.deleteTodo(id);
      await this.loadTodos();
    } catch (error) {
      this.errorMessage.set('Error deleting todo');
      console.error(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async deleteCompletedTodos() {
    if (!confirm('Delete all completed todos?')) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      await this.firestoreService.deleteCompletedTodos();
      await this.loadTodos();
    } catch (error) {
      this.errorMessage.set('Error deleting completed todos');
      console.error(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  hasCompletedTodos(): boolean {
    return this.todos().some((todo) => todo.completed);
  }
}
