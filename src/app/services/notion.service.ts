import { Injectable } from '@angular/core';
import type { NotionTask, NotionConfig } from './notion.types';

@Injectable({ providedIn: 'root' })
export class NotionService {
  isAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.typecal?.getTodayOpenTasks === 'function';
  }

  async getTodayOpenTasks(): Promise<NotionTask[]> {
    if (!this.isAvailable()) {
      throw new Error('Notion integration unavailable');
    }
    return window.typecal!.getTodayOpenTasks();
  }

  async getConfig(): Promise<NotionConfig> {
    if (!this.isAvailable()) {
      throw new Error('Notion integration unavailable');
    }
    return window.typecal!.getNotionConfig();
  }

  async setConfig(config: NotionConfig): Promise<NotionConfig> {
    if (!this.isAvailable()) {
      throw new Error('Notion integration unavailable');
    }
    return window.typecal!.setNotionConfig(config);
  }
}
