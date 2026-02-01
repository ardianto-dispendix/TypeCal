import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <div class="app-wrapper">
      <div class="custom-title-bar">
        <span class="app-title">TypeCal</span>
      </div>
      <div class="container">
        <app-calculator></app-calculator>
      </div>
    </div>
  `,
  styles: [`
    .app-wrapper {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
      background-color: #212225;
    }

    .custom-title-bar {
      background-color: #212225;
      display: flex;
      align-items: center;
      -webkit-app-region: drag;
      align-items: center;
      height: 12%;
    }

    .app-title {
      color: #9CD14E;
      font-size: 13px;
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      user-select: none;
      text-align: center;
      width: 100%;
    }
    
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

