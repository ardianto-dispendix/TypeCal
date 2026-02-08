import type { NotionTask, NotionConfig } from '../app/services/notion.types';
import type { GoogleCalendarConfig, GoogleCalendarEvent } from '../app/services/google-calendar.types';
import type { TranslationRequest, TranslationResponse, TranslatorConfig } from '../app/services/translator.types';

declare global {
  interface Window {
    typecal?: {
      version: () => string;
      getTodayOpenTasks: () => Promise<NotionTask[]>;
      getNotionConfig: () => Promise<NotionConfig>;
      setNotionConfig: (config: NotionConfig) => Promise<NotionConfig>;
      getTodayCalendarEvents: () => Promise<GoogleCalendarEvent[]>;
      getGoogleCalendarConfig: () => Promise<GoogleCalendarConfig>;
      setGoogleCalendarConfig: (config: GoogleCalendarConfig) => Promise<GoogleCalendarConfig>;
      translateWithCli: (payload: TranslationRequest) => Promise<TranslationResponse>;
      getTranslatorConfig: () => Promise<TranslatorConfig>;
      setTranslatorConfig: (config: TranslatorConfig) => Promise<TranslatorConfig>;
    };
  }
}

export {};
