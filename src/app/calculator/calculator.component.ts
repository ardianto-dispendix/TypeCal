import { Component, AfterViewInit, ElementRef, ViewChild  } from '@angular/core';
import * as math from 'mathjs';
import { CurrencyService } from '../services/currency.service';

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
export class CalculatorComponent implements AfterViewInit {
  @ViewChild('expressionInput') private expressionInput?: ElementRef<HTMLTextAreaElement>;

  inputText: string = '';
  results: CalculationResult[] = [];
  variables: Map<string, number> = new Map();
  
  constructor(private currencyService: CurrencyService) {
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.resizeInputToContent());
  }
  
  onInputChange(): void {
    this.calculateFromText();
    this.resizeInputToContent();
  }
  
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      this.calculateFromText();
    }
  }
  
  private calculateFromText(): void {
    if (!this.inputText.trim()) {
      this.results = [];
      return;
    }
    
    const lines = this.inputText.split('\n').filter(line => line.trim());
    const newResults: CalculationResult[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
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
    console.log(newResults.length)
    this.results = newResults;
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
}
