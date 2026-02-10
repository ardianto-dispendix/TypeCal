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

  async markTaskDone(taskId: string): Promise<void> {
    if (!this.isAvailable() || typeof window.typecal?.markTaskDone !== 'function') {
      throw new Error('Notion integration unavailable');
    }
    await window.typecal.markTaskDone(taskId);
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
