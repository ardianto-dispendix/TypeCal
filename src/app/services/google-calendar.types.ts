export interface GoogleCalendarEvent {
  id: string;
  title: string;
  calendarId: string;
  calendarName: string;
  start: string;
  end?: string;
  isAllDay: boolean;
}

export interface GoogleCalendarConfig {
  calendarIcsUrls?: string[];
  calendarIcsUrl?: string;
}
