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

type UnitCategory = 'length' | 'mass' | 'volume' | 'temperature';

interface UnitDefinition {
  category: UnitCategory;
  toBase: (value: number) => number;
  fromBase: (value: number) => number;
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
  notionUpdatingTaskIds = new Set<string>();
  calendarEvents: GoogleCalendarEvent[] = [];
  calendarLoading = false;
  calendarError = '';
  calendarAvailable = false;
  calendarConfigured = false;
  googleCredentialsPathInput = '';
  googleTokenPathInput = '';
  private calculationRunId = 0;
  private readonly unitAliases: Record<string, string> = {
    // Length
    mm: 'mm', millimeter: 'mm', millimeters: 'mm',
    cm: 'cm', centimeter: 'cm', centimeters: 'cm',
    m: 'm', meter: 'm', meters: 'm',
    km: 'km', kilometer: 'km', kilometers: 'km',
    in: 'in', inch: 'in', inches: 'in',
    ft: 'ft', foot: 'ft', feet: 'ft',
    yd: 'yd', yard: 'yd', yards: 'yd',
    mi: 'mi', mile: 'mi', miles: 'mi',
    // Mass
    mg: 'mg', milligram: 'mg', milligrams: 'mg',
    g: 'g', gram: 'g', grams: 'g',
    kg: 'kg', kilogram: 'kg', kilograms: 'kg',
    oz: 'oz', ounce: 'oz', ounces: 'oz',
    lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
    // Volume
    ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
    l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
    cup: 'cup', cups: 'cup',
    pt: 'pt', pint: 'pt', pints: 'pt',
    qt: 'qt', quart: 'qt', quarts: 'qt',
    gal: 'gal', gallon: 'gal', gallons: 'gal',
    // Temperature
    c: 'c', celcius: 'c', celsius: 'c',
    f: 'f', fahrenheit: 'f',
    k: 'k', kelvin: 'k',
  };

  private readonly unitDefinitions: Record<string, UnitDefinition> = {
    // Length base: meter
    mm: { category: 'length', toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
    cm: { category: 'length', toBase: (v) => v / 100, fromBase: (v) => v * 100 },
    m: { category: 'length', toBase: (v) => v, fromBase: (v) => v },
    km: { category: 'length', toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
    in: { category: 'length', toBase: (v) => v * 0.0254, fromBase: (v) => v / 0.0254 },
    ft: { category: 'length', toBase: (v) => v * 0.3048, fromBase: (v) => v / 0.3048 },
    yd: { category: 'length', toBase: (v) => v * 0.9144, fromBase: (v) => v / 0.9144 },
    mi: { category: 'length', toBase: (v) => v * 1609.344, fromBase: (v) => v / 1609.344 },
    // Mass base: kilogram
    mg: { category: 'mass', toBase: (v) => v / 1_000_000, fromBase: (v) => v * 1_000_000 },
    g: { category: 'mass', toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
    kg: { category: 'mass', toBase: (v) => v, fromBase: (v) => v },
    oz: { category: 'mass', toBase: (v) => v * 0.028349523125, fromBase: (v) => v / 0.028349523125 },
    lb: { category: 'mass', toBase: (v) => v * 0.45359237, fromBase: (v) => v / 0.45359237 },
    // Volume base: liter
    ml: { category: 'volume', toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
    l: { category: 'volume', toBase: (v) => v, fromBase: (v) => v },
    cup: { category: 'volume', toBase: (v) => v * 0.2365882365, fromBase: (v) => v / 0.2365882365 },
    pt: { category: 'volume', toBase: (v) => v * 0.473176473, fromBase: (v) => v / 0.473176473 },
    qt: { category: 'volume', toBase: (v) => v * 0.946352946, fromBase: (v) => v / 0.946352946 },
    gal: { category: 'volume', toBase: (v) => v * 3.785411784, fromBase: (v) => v / 3.785411784 },
    // Temperature base: Celsius
    c: { category: 'temperature', toBase: (v) => v, fromBase: (v) => v },
    f: { category: 'temperature', toBase: (v) => (v - 32) * (5 / 9), fromBase: (v) => (v * 9) / 5 + 32 },
    k: { category: 'temperature', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
  };
  
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
              const unitMatch = this.parseUnitConversion(trimmedLine);
              if (unitMatch) {
                newResults.push({
                  result: this.formatResult(unitMatch.convertedValue),
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
    // Patterns:
    // - "100 usd to idr"
    // - "var1 usd tp idr"
    // - "(a+b) usd to eur"
    const currencyPattern = /^(.+?)\s*([a-zA-Z]{3})\s+(?:to|tp)\s+([a-zA-Z]{3})$/i;
    const match = text.match(currencyPattern);
    
    if (match) {
      const amountExpression = match[1].trim();
      const fromCurrency = match[2];
      const toCurrency = match[3];

      try {
        const amount = this.evaluateExpression(amountExpression);
        if (this.currencyService.isCurrencyValid(fromCurrency) && this.currencyService.isCurrencyValid(toCurrency)) {
          return { amount, fromCurrency, toCurrency };
        }
      } catch (error) {
        return null;
      }
    }
    
    return null;
  }

  private parseUnitConversion(text: string): { convertedValue: number } | null {
    // Patterns:
    // - "10 km to mi"
    // - "var1 ft tp m"
    // - "(a+b) lb to kg"
    const unitPattern = /^(.+?)\s*([a-zA-Z]+)\s+(?:to|tp)\s+([a-zA-Z]+)$/i;
    const match = text.match(unitPattern);
    if (!match) {
      return null;
    }

    const amountExpression = match[1].trim();
    const fromKey = this.normalizeUnit(match[2]);
    const toKey = this.normalizeUnit(match[3]);
    if (!fromKey || !toKey) {
      return null;
    }

    const fromDefinition = this.unitDefinitions[fromKey];
    const toDefinition = this.unitDefinitions[toKey];
    if (!fromDefinition || !toDefinition) {
      return null;
    }
    if (fromDefinition.category !== toDefinition.category) {
      return null;
    }

    try {
      const amount = this.evaluateExpression(amountExpression);
      const convertedBase = fromDefinition.toBase(amount);
      return { convertedValue: toDefinition.fromBase(convertedBase) };
    } catch (error) {
      return null;
    }
  }

  private normalizeUnit(raw: string): string | null {
    const key = raw.trim().toLowerCase();
    return this.unitAliases[key] || null;
  }
  
  private isCalculableExpression(text: string): boolean {
    if (this.parseVariableAssignment(text)) {
      return true;
    }
    if (this.parseCurrencyConversion(text)) {
      return true;
    }
    if (this.parseUnitConversion(text)) {
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

  isTaskUpdating(taskId: string): boolean {
    return this.notionUpdatingTaskIds.has(taskId);
  }

  async markTaskDone(task: NotionTask): Promise<void> {
    if (!task.id || this.isTaskUpdating(task.id)) {
      return;
    }

    this.notionError = '';
    this.notionUpdatingTaskIds.add(task.id);
    try {
      await this.notionService.markTaskDone(task.id);
      this.notionTasks = this.notionTasks.filter((item) => item.id !== task.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update Notion task';
      this.notionError = message;
    } finally {
      this.notionUpdatingTaskIds.delete(task.id);
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
