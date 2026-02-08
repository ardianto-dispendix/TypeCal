export interface TranslatorConfig {
  translatorCliCommand?: string;
  translatorModel?: string;
}

export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslationResponse {
  translatedText: string;
}
