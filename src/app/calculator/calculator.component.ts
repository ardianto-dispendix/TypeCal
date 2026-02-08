import { Component, AfterViewInit, ElementRef, ViewChild, OnInit } from '@angular/core';
import * as math from 'mathjs';
import { CurrencyService } from '../services/currency.service';
import { NotionService } from '../services/notion.service';
import { GoogleCalendarService } from '../services/google-calendar.service';
import type { GoogleCalendarConfig, GoogleCalendarEvent } from '../services/google-calendar.types';
import type { NotionConfig, NotionTask } from '../services/notion.types';
import { TranslatorService } from '../services/translator.service';

interface CalculationResult {
  result: string;
  isError: boolean;
  timestamp: Date;
  isEmptySpace: boolean;
}

@Component({
  selector: 'app-calculator',
  templateUrl: './calculator.component.html',
  styleUrls: ['./calculator.component.scss']
})
export class CalculatorComponent implements AfterViewInit, OnInit {
  @ViewChild('expressionInput') private expressionInput?: ElementRef<HTMLTextAreaElement>;

  inputText: string = '';
  results: CalculationResult[] = [];
  variables: Map<string, number> = new Map();
  notionTasks: NotionTask[] = [];
  notionLoading = false;
  notionError = '';
  notionAvailable = false;
  notionConfigured = false;
  notionApiKeyInput = '';
  notionDbIdInput = '';
  calendarEvents: GoogleCalendarEvent[] = [];
  calendarLoading = false;
  calendarError = '';
  calendarAvailable = false;
  calendarConfigured = false;
  googleCredentialsPathInput = '';
  googleTokenPathInput = '';
  private calculationRunId = 0;
  
  constructor(
    private currencyService: CurrencyService,
    private notionService: NotionService,
    private googleCalendarService: GoogleCalendarService,
    private translatorService: TranslatorService
  ) {
  }

  ngOnInit(): void {
    this.notionAvailable = this.notionService.isAvailable();
    this.calendarAvailable = this.googleCalendarService.isAvailable();
    if (this.notionAvailable) {
      this.loadNotionConfig();
    }
    if (this.calendarAvailable) {
      this.loadGoogleCalendarConfig();
    }
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.resizeInputToContent());
  }
  
  onInputChange(): void {
    void this.calculateFromText();
    this.resizeInputToContent();
  }
  
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      void this.calculateFromText();
    }
  }
  
  private async calculateFromText(): Promise<void> {
    const runId = ++this.calculationRunId;
    if (!this.inputText.trim()) {
      this.results = [];
      return;
    }
    
    const lines = this.inputText.split('\n').filter(line => line.trim());
    const newResults: CalculationResult[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      const translationCommand = this.parseTranslationCommand(trimmedLine);
      if (translationCommand) {
        const translated = await this.translateLine(translationCommand.text, translationCommand.targetLanguage);
        if (translated) {
          newResults.push({
            result: translated,
            isError: false,
            timestamp: new Date(),
            isEmptySpace: false
          });
          if (trimmedLine.length > 31) {
            newResults.push({
              result: "",
              isError: false,
              timestamp: new Date(),
              isEmptySpace: true
            });
          }
        }
        continue;
      }

      // A line starting with "trans" but not yet complete should not show calculator errors.
      if (this.startsWithTranslationPrefix(trimmedLine)) {
        continue;
      }

      if (trimmedLine && this.isCalculableExpression(trimmedLine)) {
        try {
          const varAssignment = this.parseVariableAssignment(trimmedLine);
          if (varAssignment) {
            const { varName, expression } = varAssignment;
            const result = this.evaluateExpression(expression);
            this.variables.set(varName, result);
            newResults.push({
              result: this.formatResult(result),
              isError: false,
              timestamp: new Date(),
              isEmptySpace: false
            });
            if (trimmedLine.length > 31) {
              newResults.push({
                result: "",
                isError: false,
                timestamp: new Date(),
                isEmptySpace: true
              });
            }
          } else {
            const currencyMatch = this.parseCurrencyConversion(trimmedLine);
            if (currencyMatch) {
              const { amount, fromCurrency, toCurrency } = currencyMatch;
              const convertedAmount = this.currencyService.convert(amount, fromCurrency, toCurrency);
              
              if (convertedAmount !== null) {
                newResults.push({
                  result: this.formatResult(convertedAmount),
                  isError: false,
                  timestamp: new Date(),
                  isEmptySpace: false
                });
                if (trimmedLine.length > 31) {
                  newResults.push({
                    result: "",
                    isError: false,
                    timestamp: new Date(),
                    isEmptySpace: true
                  });
                }
              } else {
                newResults.push({
                  result: '',
                  isError: true,
                  timestamp: new Date(),
                  isEmptySpace: false
                });
              }
            } else {
              const result = this.evaluateExpression(trimmedLine);
              newResults.push({
                result: this.formatResult(result),
                isError: false,
                timestamp: new Date(),
                isEmptySpace: false
              });
              if (trimmedLine.length > 31) {
                newResults.push({
                  result: "",
                  isError: false,
                  timestamp: new Date(),
                  isEmptySpace: true
                });
              }
            }
          }
        } catch (error) {
          newResults.push({
            result: '',
            isError: true,
            timestamp: new Date(),
            isEmptySpace: false
          });
        }
      }
    }
    if (runId === this.calculationRunId) {
      this.results = newResults;
    }
  }

  private startsWithTranslationPrefix(text: string): boolean {
    return /^trans\b/i.test(text);
  }

  private parseTranslationCommand(text: string): { targetLanguage: string; text: string } | null {
    const commandPattern = /^trans\s+(en|de|bi)\s+(.+)$/i;
    const match = text.match(commandPattern);
    if (!match) {
      return null;
    }

    const languageCode = match[1].toLowerCase();
    const targetText = match[2].trim();
    if (!targetText) {
      return null;
    }

    const languageMap: Record<string, string> = {
      en: 'English',
      de: 'German',
      bi: 'Bahasa Indonesia',
    };

    const targetLanguage = languageMap[languageCode];
    if (!targetLanguage) {
      return null;
    }

    return { targetLanguage, text: targetText };
  }

  private async translateLine(text: string, targetLanguage: string): Promise<string | null> {
    if (!this.translatorService.isAvailable()) {
      return null;
    }
    try {
      const translated = await this.translatorService.translate({
        text,
        sourceLanguage: 'Auto',
        targetLanguage,
      });
      return translated.translatedText?.trim() || null;
    } catch (error) {
      // If Codex CLI is unavailable or translation fails, keep the calculator output unchanged.
      return null;
    }
  }

  private parseVariableAssignment(text: string): { varName: string; expression: string } | null {
    // Pattern: "varname = expression"
    const assignmentPattern = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/;
    const match = text.match(assignmentPattern);
    
    if (match) {
      const varName = match[1];
      const expression = match[2].trim();
      if (!text.includes('==') && !text.includes('!=')) {
        return { varName, expression };
      }
    }
    
    return null;
  }

  private parseCurrencyConversion(text: string): { amount: number; fromCurrency: string; toCurrency: string } | null {
    // Pattern: "100 usd to idr" or "100usd to idr" or "100 usd to idr"
    const currencyPattern = /^(\d+\.?\d*)\s*([a-zA-Z]{3})\s+to\s+([a-zA-Z]{3})$/i;
    const match = text.match(currencyPattern);
    
    if (match) {
      const amount = parseFloat(match[1]);
      const fromCurrency = match[2];
      const toCurrency = match[3];
      
      if (this.currencyService.isCurrencyValid(fromCurrency) && this.currencyService.isCurrencyValid(toCurrency)) {
        return { amount, fromCurrency, toCurrency };
      }
    }
    
    return null;
  }
  
  private isCalculableExpression(text: string): boolean {
    if (this.parseVariableAssignment(text)) {
      return true;
    }
    if (this.parseCurrencyConversion(text)) {
      return true;
    }

    const mathPatterns = [
      /\d+[\+\-\*\/\%\^]\d+/,  // Basic arithmetic
      /\d+\s*[\+\-\*\/\%\^]\s*\d+/,  // With spaces
      /sqrt\(/,  // Square root
      /sin\(|cos\(|tan\(/,  // Trigonometric
      /log\(|ln\(/,  // Logarithms
      /abs\(/,  // Absolute value
      /pow\(/,  // Power
      /^\d+\s*[\+\-\*\/\%\^]/,  // Starting with number and operator
      /[\+\-\*\/\%\^]\s*\d+$/,  // Ending with operator and number
      /\(\s*\d+/,  // Parentheses with numbers
      /\d+\s*\)/,
      /\bpi\b|\be\b/i,  // Constants
      /[a-zA-Z_][a-zA-Z0-9_]*/,  // Variables
    ];
    
    return mathPatterns.some(pattern => pattern.test(text));
  }
  
  private evaluateExpression(expression: string): number {
    try {
      const scope: any = {};
      this.variables.forEach((value, key) => {
        scope[key] = value;
      });
      const result = math.evaluate(expression, scope);
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Invalid result');
      }
      return result;
    } catch (error) {
      throw new Error('Cannot evaluate expression');
    }
  }
  
  private formatResult(result: number): string {
    const rounded = Math.round(result * 100) / 100;
    const parts = rounded.toFixed(2).split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    let cleanDecimal = decimalPart.replace(/0+$/, '');
    if (cleanDecimal) {
      return `${formattedInteger},${cleanDecimal}`;
    }
    
    return formattedInteger;
  }
  
  clearAll(): void {
    this.inputText = '';
    this.results = [];
    this.variables.clear();
    this.resizeInputToContent();
  }

  private resizeInputToContent(): void {
    const textarea = this.expressionInput?.nativeElement;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }
  
  copyResults(): void {
    const resultText = this.results
      .map(r => `${r.result}`)
      .join('\n');
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(resultText);
    }
  }

  async refreshNotionTasks(): Promise<void> {
    this.notionLoading = true;
    this.notionError = '';
    try {
      this.notionTasks = await this.notionService.getTodayOpenTasks();
      this.notionConfigured = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load Notion tasks';
      this.notionError = message;
      this.notionTasks = [];
      if (message.toLowerCase().includes('missing notion_api_key')) {
        this.notionConfigured = false;
      }
    } finally {
      this.notionLoading = false;
    }
  }

  async loadNotionConfig(): Promise<void> {
    try {
      const config = await this.notionService.getConfig();
      this.notionConfigured = !!config.notionApiKey;
      this.notionDbIdInput = config.notionTasksDbId || '';
      await this.refreshNotionTasks();
    } catch (error) {
      this.notionConfigured = false;
    }
  }

  async saveNotionConfig(): Promise<void> {
    this.notionError = '';
    const payload: NotionConfig = {
      notionApiKey: this.notionApiKeyInput.trim(),
      notionTasksDbId: this.notionDbIdInput.trim(),
    };

    if (!payload.notionApiKey) {
      this.notionError = 'Please enter a Notion API key.';
      return;
    }

    try {
      const updated = await this.notionService.setConfig(payload);
      this.notionConfigured = !!updated.notionApiKey;
      this.notionApiKeyInput = '';
      await this.refreshNotionTasks();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save Notion settings';
      this.notionError = message;
    }
  }

  async refreshCalendarEvents(): Promise<void> {
    this.calendarLoading = true;
    this.calendarError = '';
    try {
      this.calendarEvents = await this.googleCalendarService.getTodayEvents();
      this.calendarConfigured = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load Google Calendar events';
      this.calendarError = message;
      this.calendarEvents = [];
      if (message.toLowerCase().includes('missing google')) {
        this.calendarConfigured = false;
      }
    } finally {
      this.calendarLoading = false;
    }
  }

  async loadGoogleCalendarConfig(): Promise<void> {
    try {
      const config = await this.googleCalendarService.getConfig();
      this.googleCredentialsPathInput = config.googleCredentialsPath || '';
      this.googleTokenPathInput = config.googleTokenPath || '';
      await this.refreshCalendarEvents();
    } catch (error) {
      this.calendarConfigured = false;
    }
  }

  async saveGoogleCalendarConfig(): Promise<void> {
    this.calendarError = '';
    const payload: GoogleCalendarConfig = {
      googleCredentialsPath: this.googleCredentialsPathInput.trim(),
      googleTokenPath: this.googleTokenPathInput.trim(),
    };

    try {
      await this.googleCalendarService.setConfig(payload);
      await this.refreshCalendarEvents();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save Google Calendar settings';
      this.calendarError = message;
    }
  }

  formatCalendarTime(event: GoogleCalendarEvent): string {
    if (event.isAllDay) {
      return 'All day';
    }
    const start = event.start ? new Date(event.start) : null;
    if (!start || Number.isNaN(start.getTime())) {
      return '-';
    }
    return start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
