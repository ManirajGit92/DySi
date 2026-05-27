import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { routes } from './app.routes';
import { WebsiteDataService, defaultFooterSettings, defaultThemeSettings } from './core/services/website-data.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        {
          provide: WebsiteDataService,
          useValue: {
            menus$: of([{ title: 'Home', routeKey: 'home', order: 1, isVisible: true, sectionId: 'home' }]),
            sections$: of([
              {
                id: 'home',
                sectionId: 'home',
                title: 'Build smarter customer experiences',
                subtitle: 'Home',
                description: 'Dynamic test content',
                imageUrl: '',
                buttonText: '',
                buttonLink: '',
                backgroundColor: '',
                textColor: '',
                fontFamily: 'Inter',
                fontSize: '16px',
                layoutType: 'hero',
                isDarkSection: true,
                isVisible: true,
                order: 1,
                cards: [],
                faqs: [],
                gallery: [],
              },
            ]),
            themeSettings$: of(defaultThemeSettings),
            footerSettings$: of(defaultFooterSettings),
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the landing hero', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Build smarter customer experiences');
  });
});
