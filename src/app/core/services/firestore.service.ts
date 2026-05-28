import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, docData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FirestoreService {
  firestore = inject(Firestore);

  getCollections(): string[] {
    return ['footerSettings', 'menus', 'sections', 'themeSettings', 'todos'];
  }

  getDocuments(collectionName: string): string[] {
    const mockDocs: any = {
      sections: ['about', 'contact', 'faq', 'feedback', 'gallery', 'services', 'team'],
    };

    return mockDocs[collectionName] || [];
  }

  getDocumentData(collectionName: string, docName: string) {
    return {
      title: 'Mission',
      icon: 'fa-solid fa-bullseye',
      description: 'Turn complex goals into reliable products.',
      items: [
        {
          title: 'Vision',
          icon: 'fa-solid fa-eye',
          description: 'Make modern software useful.',
        },
        {
          title: 'Values',
          icon: 'fa-solid fa-handshake',
          description: 'Partnership and care.',
        },
      ],
      createdDate: new Date(),
    };
  }
}
