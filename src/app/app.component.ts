import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <div class="container">
      <h1>Text Calculator</h1>
      <p>A mathematical expression calculator similar to Numi</p>
      <app-calculator></app-calculator>
    </div>
  `,
  styles: [`
    h1 {
      text-align: center;
      color: #333;
      margin-bottom: 10px;
      font-weight: 300;
      font-size: 2.5rem;
    }
    
    p {
      text-align: center;
      color: #666;
      margin-bottom: 30px;
      font-size: 1.1rem;
    }
  `]
})
export class AppComponent {
  title = 'text-calculator';
}
