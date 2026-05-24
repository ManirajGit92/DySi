# Quick Start Guide - Angular Firestore CRUD App

## What's Included

Your Angular application with Firestore integration includes:

### ✅ Complete CRUD Implementation

- **Create**: Add new todos with title and description
- **Read**: Display all todos from Firestore
- **Update**: Edit todos or mark as complete
- **Delete**: Remove todos individually or in bulk

### ✅ Files Created

1. **`src/app/services/firestore.service.ts`** - Firestore database service with all CRUD methods
2. **`src/app/app.ts`** - Main component with UI logic
3. **`src/app/app.html`** - Todo manager interface
4. **`src/app/app.css`** - Responsive styling
5. **`src/app/app.config.ts`** - Firebase configuration setup
6. **`src/environments/environment.ts`** - Firebase credentials placeholder

## Quick Setup (3 Steps)

### Step 1: Configure Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing one
3. Create a Firestore Database
4. Copy your configuration credentials

### Step 2: Update Environment File

Edit `src/environments/environment.ts`:

```typescript
export const environment = {
  firebaseConfig: {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT_ID.appspot.com',
    messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
    appId: 'YOUR_APP_ID',
  },
};
```

### Step 3: Run the App

```bash
cd firestore-crud
ng serve
```

Navigate to `http://localhost:4200/`

## API Reference

### Firestore Service Methods

```typescript
// Add a new todo
await firestoreService.addTodo({
  title: 'My Task',
  description: 'Task details',
  completed: false,
});

// Get all todos
const todos = await firestoreService.getAllTodos();

// Get single todo
const todo = await firestoreService.getTodoById(id);

// Update a todo
await firestoreService.updateTodo(id, {
  completed: true,
  title: 'Updated Title',
});

// Delete a todo
await firestoreService.deleteTodo(id);

// Delete all completed todos
await firestoreService.deleteCompletedTodos();
```

## Component Methods

```typescript
// Load todos from Firestore
await loadTodos();

// Add new todo
await addTodo();

// Toggle todo completion status
await toggleTodo(todo);

// Edit todo
startEditing(todo);
await saveTodo();
cancelEditing();

// Delete todo
await deleteTodo(id);

// Delete completed todos
await deleteCompletedTodos();

// Check if completed todos exist
hasCompletedTodos(): boolean;
```

## Firestore Collection Schema

**Collection Name**: `todos`

**Document Fields**:

- `title` (string) - Required
- `description` (string) - Optional
- `completed` (boolean) - Default: false
- `createdAt` (Timestamp) - Auto-generated

## Features

✨ **Real-time Updates** - Data syncs with Firestore instantly
✨ **Error Handling** - User-friendly error messages
✨ **Loading States** - Visual feedback during operations
✨ **Responsive Design** - Works on desktop and mobile
✨ **Form Validation** - Required field validation
✨ **Confirmation Dialogs** - Prevent accidental deletions

## Build for Production

```bash
ng build --configuration production
```

Output will be in `dist/firestore-crud/`

## File Structure

```
firestore-crud/
├── src/
│   ├── app/
│   │   ├── services/
│   │   │   └── firestore.service.ts
│   │   ├── app.ts
│   │   ├── app.html
│   │   ├── app.css
│   │   ├── app.config.ts
│   │   └── app.routes.ts
│   ├── environments/
│   │   └── environment.ts
│   └── main.ts
├── angular.json
├── package.json
└── tsconfig.json
```

## Common Tasks

### Add a new property to Todo

1. Update `Todo` interface in `firestore.service.ts`
2. Update Firestore service methods as needed
3. Update template to display the property

### Change database collection name

- Update collection reference in `firestore.service.ts`:
  ```typescript
  this.todosCollection = collection(this.firestore, 'your-collection-name');
  ```

### Add authentication

- Import `provideAuth` and `getAuth` from `@angular/fire/auth`
- Add to `app.config.ts` providers
- Use `Auth` service in your components

### Enable offline persistence

- Import Firestore functions
- Call `enableIndexedDbPersistence(db)` in `app.config.ts`

## Useful Commands

```bash
# Start development server
ng serve

# Build for production
ng build

# Run tests
ng test

# Lint code
ng lint

# Generate new component
ng generate component my-component

# Generate new service
ng generate service my-service
```

## Deployment Options

1. **Firebase Hosting** - Recommended for Angular apps
2. **Vercel** - Zero-config deployment
3. **Netlify** - Easy CI/CD integration
4. **Any static host** - Just deploy the `dist/` folder

## Troubleshooting

| Issue                       | Solution                               |
| --------------------------- | -------------------------------------- |
| Firebase config errors      | Verify credentials in `environment.ts` |
| Firestore permission denied | Check Firestore security rules         |
| Dependency conflicts        | Run `npm install --legacy-peer-deps`   |
| Port 4200 already in use    | Use `ng serve --port 4201`             |

## Resources

- [Angular Docs](https://angular.dev)
- [Firebase Docs](https://firebase.google.com/docs)
- [AngularFire Docs](https://github.com/angular/angularfire)
- [Firestore Docs](https://firebase.google.com/docs/firestore)

## Support

For issues or questions:

1. Check Firebase Console for errors
2. Review browser console for TypeScript errors
3. Verify Firestore collection name and schema
4. Check network tab for failed requests

Happy coding! 🚀
