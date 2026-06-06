import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { WebsiteDataService } from '../services/website-data.service';
import { filter, map, switchMap, take, of } from 'rxjs';

export const superAdminGuard: CanActivateFn = () => {
  const websiteData = inject(WebsiteDataService);
  const router = inject(Router);

  return websiteData.authInitialized$.pipe(
    filter((initialized) => initialized),
    switchMap(() => websiteData.user$),
    take(1),
    switchMap((user) => {
      if (!user) {
        // Unauthenticated -> redirect to Admin Login page
        void router.navigate(['/admin']);
        return of(false);
      }
      // Authenticated -> check Super Admin role in Firestore/hardcode
      return websiteData.isSuperAdmin$.pipe(
        take(1),
        map((isSuper) => {
          if (isSuper) {
            return true;
          } else {
            // Not a Super Admin -> redirect to home
            void router.navigate(['/']);
            return false;
          }
        })
      );
    })
  );
};
