import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentData,
  Query,
  query,
  where,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface Todo {
  id?: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt?: Date;
}

@Injectable({
  providedIn: 'root',
})
export class FirestoreService {
  private todosCollection: CollectionReference<DocumentData>;

  constructor(private firestore: Firestore) {
    this.todosCollection = collection(this.firestore, 'todos');
  }

  // CREATE: Add a new todo
  async addTodo(todo: Todo): Promise<string> {
    try {
      const docRef = await addDoc(this.todosCollection, {
        ...todo,
        createdAt: new Date(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding todo:', error);
      throw error;
    }
  }

  // READ: Get all todos
  async getAllTodos(): Promise<Todo[]> {
    try {
      const snapshot = await getDocs(this.todosCollection);
      const todos: Todo[] = [];
      snapshot.forEach((doc) => {
        todos.push({
          id: doc.id,
          ...(doc.data() as Omit<Todo, 'id'>),
        });
      });
      return todos;
    } catch (error) {
      console.error('Error getting todos:', error);
      throw error;
    }
  }

  // READ: Get a specific todo by ID
  async getTodoById(id: string): Promise<Todo | null> {
    try {
      const docRef = doc(this.firestore, 'todos', id);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return {
          id: snapshot.id,
          ...(snapshot.data() as Omit<Todo, 'id'>),
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting todo:', error);
      throw error;
    }
  }

  // UPDATE: Update an existing todo
  async updateTodo(id: string, updates: Partial<Todo>): Promise<void> {
    try {
      const docRef = doc(this.firestore, 'todos', id);
      await updateDoc(docRef, updates);
    } catch (error) {
      console.error('Error updating todo:', error);
      throw error;
    }
  }

  // DELETE: Delete a todo
  async deleteTodo(id: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, 'todos', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting todo:', error);
      throw error;
    }
  }

  // DELETE: Delete all completed todos
  async deleteCompletedTodos(): Promise<void> {
    try {
      const snapshot = await getDocs(query(this.todosCollection, where('completed', '==', true)));
      const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error deleting completed todos:', error);
      throw error;
    }
  }
}
