import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { evaluate } from 'mathjs';

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
  
  constructor() {
    //this.addExample();
  }

  ngAfterViewInit(): void {
    // Ensure initial layout is consistent even before the first input event.
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
  
  private isCalculableExpression(text: string): boolean {
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
    ];
    
    return mathPatterns.some(pattern => pattern.test(text));
  }
  
  private evaluateExpression(expression: string): number {
    try {
      const result = evaluate(expression);
      
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Invalid result');
      }
      
      return result;
    } catch (error) {
      throw new Error('Cannot evaluate expression');
    }
  }
  
  private formatResult(result: number): string {
    if (Number.isInteger(result)) {
      return result.toString();
    }
    
    const rounded = Math.round(result * 1000000) / 1000000;
    return rounded.toString().replace(/\.?0+$/, '');
  }
  
  clearAll(): void {
    this.inputText = '';
    this.results = [];
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
  
  private addExample(): void {
    this.inputText = `Calculate the area of a circle with radius 5
pi * 5^2

Convert 100 fahrenheit to celsius  
(100 - 32) * 5/9

Calculate compound interest
1000 * (1 + 0.05)^10

Basic calculations
15 + 25 * 2
sqrt(144)
sin(45 * pi/180)
log(100)
abs(-42)`;
    
    this.calculateFromText();
  }
}
