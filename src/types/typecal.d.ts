import type { NotionTask, NotionConfig } from '../app/services/notion.types';

declare global {
  interface Window {
    typecal?: {
      version: () => string;
      getTodayOpenTasks: () => Promise<NotionTask[]>;
      getNotionConfig: () => Promise<NotionConfig>;
      setNotionConfig: (config: NotionConfig) => Promise<NotionConfig>;
    };
  }
}

export {};
