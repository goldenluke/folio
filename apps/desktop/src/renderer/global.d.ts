import type { AcademicDesktopApi } from '../shared/api.js';

declare global {
  interface Window {
    readonly academic: AcademicDesktopApi;
  }
}

export {};
