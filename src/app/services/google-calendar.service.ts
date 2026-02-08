import { Injectable } from '@angular/core';
import type { GoogleCalendarConfig, GoogleCalendarEvent } from './google-calendar.types';

@Injectable({ providedIn: 'root' })
export class GoogleCalendarService {
  isAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.typecal?.getTodayCalendarEvents === 'function';
  }

  async getTodayEvents(): Promise<GoogleCalendarEvent[]> {
    if (!this.isAvailable()) {
      throw new Error('Google Calendar integration unavailable');
    }
    return window.typecal!.getTodayCalendarEvents();
  }

  async getConfig(): Promise<GoogleCalendarConfig> {
    if (!this.isAvailable()) {
      throw new Error('Google Calendar integration unavailable');
    }
    return window.typecal!.getGoogleCalendarConfig();
  }

  async setConfig(config: GoogleCalendarConfig): Promise<GoogleCalendarConfig> {
    if (!this.isAvailable()) {
      throw new Error('Google Calendar integration unavailable');
    }
    return window.typecal!.setGoogleCalendarConfig(config);
  }
}
