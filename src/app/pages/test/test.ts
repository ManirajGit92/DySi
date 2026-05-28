import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PanelModule } from 'primeng/panel';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { ToolbarModule } from 'primeng/toolbar';
import { InputTextModule } from 'primeng/inputtext';

import { FirestoreService } from '../../core/services/firestore.service';

@Component({
  selector: 'app-test',
  standalone: true,
  imports: [
    CommonModule,
    PanelModule,
    ButtonModule,
    DividerModule,
    ScrollPanelModule,
    ToolbarModule,
    InputTextModule,
  ],
  templateUrl: './test.html',
  styleUrls: ['./test.css'],
})
export class TestComponent implements OnInit {
  collections: string[] = [];
  documents: string[] = [];

  selectedCollection = 'sections';
  selectedDocument = 'about';

  documentData: any;

  constructor(private firestoreService: FirestoreService) {}

  ngOnInit(): void {
    this.collections = this.firestoreService.getCollections();
    this.loadDocuments();
    this.loadDocumentData();
  }

  loadDocuments() {
    this.documents = this.firestoreService.getDocuments(this.selectedCollection);
  }

  loadDocumentData() {
    this.documentData = this.firestoreService.getDocumentData(
      this.selectedCollection,
      this.selectedDocument,
    );
  }

  selectCollection(collection: string) {
    this.selectedCollection = collection;
    this.loadDocuments();
  }

  selectDocument(document: string) {
    this.selectedDocument = document;
    this.loadDocumentData();
  }

  objectKeys(obj: any) {
    return Object.keys(obj);
  }
}
