# Firestore CRUD Angular Application

A simple Angular application demonstrating CRUD (Create, Read, Update, Delete) operations with Google Firestore database.

## Features

- **Create**: Add new todos with title and description
- **Read**: Display list of all todos from Firestore
- **Update**: Edit existing todos or mark them as completed
- **Delete**: Remove individual todos or bulk delete completed todos
- **Real-time UI**: Responsive interface with loading states and error handling

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Firebase account with a Firestore database
- Angular CLI

## Installation

1. Navigate to the project directory:

```bash
cd firestore-crud
```

2. Install dependencies (already done, but you can reinstall if needed):

```bash
npm install --legacy-peer-deps
```

## Configuration

### Setting up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Enable Firestore Database
4. Get your Firebase configuration credentials

### Update Environment Configuration

Edit `src/environments/environment.ts` and replace the placeholder values with your Firebase credentials:

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

## Running the Application

### Development Server

Start the development server:

```bash
ng serve
```

Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

### Build for Production

Build the project for production:

```bash
ng build
```

The build artifacts will be stored in the `dist/` directory.

## Project Structure

```
src/
├── app/
│   ├── app.ts              # Main component with CRUD logic
│   ├── app.html            # Component template
│   ├── app.css             # Component styles
│   ├── app.config.ts       # Angular and Firebase configuration
│   ├── services/
│   │   └── firestore.service.ts  # Firestore CRUD service
│   └── app.routes.ts       # Routing configuration
├── environments/
│   └── environment.ts      # Firebase configuration
└── main.ts                 # Application entry point
```

## CRUD Operations

### Create (Add Todo)

- Enter title and optional description
- Click "Add Todo" button
- Data is saved to Firestore's `todos` collection

### Read (View Todos)

- Todos are automatically loaded from Firestore on app initialization
- Displays all todos in a list with completion status

### Update (Edit Todo)

- Click "Edit" button on any todo
- Modify title or description
- Click "Save Changes" to update
- Toggle checkbox to mark todo as completed/incomplete

### Delete (Remove Todo)

- Click "Delete" button to remove a single todo
- Click "Delete Completed Todos" to bulk delete all completed todos
- Confirmation dialogs prevent accidental deletion

## Firestore Collection Structure

**Collection**: `todos`

**Document fields**:

```typescript
{
  title: string; // Todo title (required)
  description: string; // Todo description (optional)
  completed: boolean; // Completion status
  createdAt: Timestamp; // Document creation timestamp
}
```

## Service Methods

The `FirestoreService` provides the following methods:

- `addTodo(todo: Todo)` - Add a new todo
- `getAllTodos()` - Fetch all todos
- `getTodoById(id: string)` - Fetch a specific todo
- `updateTodo(id: string, updates: Partial<Todo>)` - Update a todo
- `deleteTodo(id: string)` - Delete a specific todo
- `deleteCompletedTodos()` - Delete all completed todos

## Styling

The application uses CSS with a responsive design that adapts to mobile devices. Styles are defined in `src/app/app.css`.

## Key Technologies

- **Angular 21**: Frontend framework
- **Firebase SDK**: Real-time database
- **AngularFire**: Angular integration with Firebase
- **TypeScript**: Programming language
- **Reactive Forms**: Form handling with FormsModule

## Troubleshooting

### Firebase Configuration Errors

- Ensure Firebase credentials are correctly set in `environment.ts`
- Check that Firestore Database is enabled in Firebase Console
- Verify Firestore security rules allow read/write operations

### Dependency Issues

- If you encounter dependency conflicts, ensure using:
  ```bash
  npm install --legacy-peer-deps
  ```

### Build Errors

- Clear node_modules and reinstall:
  ```bash
  rm -r node_modules package-lock.json
  npm install --legacy-peer-deps
  ```

## Security Note

Never commit your Firebase configuration to version control. Use environment variables or a configuration management system in production.

## License

This project is provided as-is for educational purposes.

## Next Steps

1. Configure Firebase credentials
2. Run `ng serve` to start the development server
3. Test CRUD operations
4. Deploy to Firebase Hosting or your preferred hosting service

For more information, refer to:

- [Angular Documentation](https://angular.dev)
- [Firebase Documentation](https://firebase.google.com/docs)
- [AngularFire Documentation](https://github.com/angular/angularfire)
