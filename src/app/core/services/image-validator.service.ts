import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ImageValidatorService {
  private readonly validImageCache = new Map<string, boolean>();
  private readonly imageLoadTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Validates if an image URL is valid and loadable
   * @param imageUrl - The URL to validate
   * @param timeoutMs - Timeout in milliseconds (default 5000)
   * @returns Promise<boolean> - true if image is valid and loads, false otherwise
   */
  validateImageUrl(imageUrl: string, timeoutMs = 5000): Promise<boolean> {
    // Check cache first
    if (this.validImageCache.has(imageUrl)) {
      return Promise.resolve(this.validImageCache.get(imageUrl) ?? false);
    }

    // Return invalid for empty or invalid URL strings
    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim().length === 0) {
      this.validImageCache.set(imageUrl, false);
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      const image = new Image();
      let isResolved = false;

      // Set up timeout
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          this.validImageCache.set(imageUrl, false);
          this.imageLoadTimeouts.delete(imageUrl);
          resolve(false);
        }
      }, timeoutMs);

      // Store timeout for cleanup
      this.imageLoadTimeouts.set(imageUrl, timeout);

      // Handle successful load
      image.onload = () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          this.validImageCache.set(imageUrl, true);
          this.imageLoadTimeouts.delete(imageUrl);
          resolve(true);
        }
      };

      // Handle load error
      image.onerror = () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          this.validImageCache.set(imageUrl, false);
          this.imageLoadTimeouts.delete(imageUrl);
          resolve(false);
        }
      };

      // Handle abort
      image.onabort = () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          this.validImageCache.set(imageUrl, false);
          this.imageLoadTimeouts.delete(imageUrl);
          resolve(false);
        }
      };

      // Start loading
      image.src = imageUrl;
    });
  }

  /**
   * Clears the validation cache
   */
  clearCache(): void {
    this.validImageCache.clear();
    this.imageLoadTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.imageLoadTimeouts.clear();
  }

  /**
   * Gets cached validation status without re-validating
   * @param imageUrl - The URL to check
   * @returns Cached validation status or undefined if not cached
   */
  getCachedStatus(imageUrl: string): boolean | undefined {
    return this.validImageCache.get(imageUrl);
  }
}
