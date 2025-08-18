import { Component } from '@angular/core';
import * as math from 'mathjs';

interface CalculationResult {
  expression: string;
  result: string;
  isError: boolean;
  timestamp: Date;
}

@Component({
  selector: 'app-calculator',
  templateUrl: './calculator.component.html',
  styleUrls: ['./calculator.component.scss']
})
export class CalculatorComponent {
  inputText: string = '';
  results: CalculationResult[] = [];
  
  constructor() {
    // Add some example calculations on startup
    this.addExample();
  }
  
  onInputChange(): void {
    this.calculateFromText();
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
            expression: trimmedLine,
            result: this.formatResult(result),
            isError: false,
            timestamp: new Date()
          });
        } catch (error) {
          newResults.push({
            expression: trimmedLine,
            result: 'Error: Invalid expression',
            isError: true,
            timestamp: new Date()
          });
        }
      }
    }
    
    this.results = newResults;
  }
  
  private isCalculableExpression(text: string): boolean {
    // Check if the line contains mathematical expressions
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
      // Use math.js evaluate function for safe mathematical expression evaluation
      const result = math.evaluate(expression);
      
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Invalid result');
      }
      
      return result;
    } catch (error) {
      throw new Error('Cannot evaluate expression');
    }
  }
  
  private formatResult(result: number): string {
    // Format the result for better display
    if (Number.isInteger(result)) {
      return result.toString();
    }
    
    // Round to 6 decimal places and remove trailing zeros
    const rounded = Math.round(result * 1000000) / 1000000;
    return rounded.toString().replace(/\.?0+$/, '');
  }
  
  clearAll(): void {
    this.inputText = '';
    this.results = [];
  }
  
  copyResults(): void {
    const resultText = this.results
      .map(r => `${r.expression} = ${r.result}`)
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