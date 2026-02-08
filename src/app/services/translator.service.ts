import { Injectable } from '@angular/core';
import type { TranslationRequest, TranslationResponse, TranslatorConfig } from './translator.types';

@Injectable({ providedIn: 'root' })
export class TranslatorService {
  isAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.typecal?.translateWithCli === 'function';
  }

  async translate(payload: TranslationRequest): Promise<TranslationResponse> {
    if (!this.isAvailable()) {
      throw new Error('Translator integration unavailable');
    }
    return window.typecal!.translateWithCli(payload);
  }

  async getConfig(): Promise<TranslatorConfig> {
    if (!this.isAvailable()) {
      throw new Error('Translator integration unavailable');
    }
    return window.typecal!.getTranslatorConfig();
  }

  async setConfig(config: TranslatorConfig): Promise<TranslatorConfig> {
    if (!this.isAvailable()) {
      throw new Error('Translator integration unavailable');
    }
    return window.typecal!.setTranslatorConfig(config);
  }
}
