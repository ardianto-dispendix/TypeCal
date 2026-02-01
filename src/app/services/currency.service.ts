import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, catchError } from 'rxjs';
import { map, tap } from 'rxjs/operators';

interface ExchangeRates {
  [key: string]: number;
}

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private exchangeRates$ = new BehaviorSubject<ExchangeRates>({});
  private lastUpdate = 0;
  private updateInterval = 3600000; // 1 hour in milliseconds

  constructor(private http: HttpClient) {
    this.loadExchangeRates();
  }

  private loadExchangeRates(): void {
    const now = Date.now();
    if (now - this.lastUpdate > this.updateInterval) {
      this.fetchExchangeRates().subscribe();
    }
  }

  private fetchExchangeRates(): Observable<ExchangeRates> {
    // Using exchangerate-api.com free tier
    // Alternatively, you can use other APIs like fixer.io, openexchangerates.org, etc.
    return this.http.get<any>('https://api.exchangerate-api.com/v4/latest/USD').pipe(
      map(response => response.rates || {}),
      tap(rates => {
        this.exchangeRates$.next(rates);
        this.lastUpdate = Date.now();
        // Store in localStorage for offline access
        localStorage.setItem('exchangeRates', JSON.stringify(rates));
        localStorage.setItem('exchangeRatesTime', this.lastUpdate.toString());
      }),
      catchError(() => {
        // Try to load from localStorage if API fails
        const cached = localStorage.getItem('exchangeRates');
        if (cached) {
          this.exchangeRates$.next(JSON.parse(cached));
        }
        return this.exchangeRates$.asObservable();
      })
    );
  }

  getExchangeRates(): Observable<ExchangeRates> {
    this.loadExchangeRates();
    return this.exchangeRates$.asObservable();
  }

  getCurrentRates(): ExchangeRates {
    let rates = this.exchangeRates$.value;
    
    // If empty, try to load from localStorage
    if (Object.keys(rates).length === 0) {
      const cached = localStorage.getItem('exchangeRates');
      if (cached) {
        rates = JSON.parse(cached);
        this.exchangeRates$.next(rates);
      }
    }
    
    return rates;
  }

  convert(amount: number, fromCurrency: string, toCurrency: string): number | null {
    const rates = this.getCurrentRates();
    
    if (Object.keys(rates).length === 0) {
      return null;
    }

    const fromRate = rates[fromCurrency.toUpperCase()];
    const toRate = rates[toCurrency.toUpperCase()];

    if (!fromRate || !toRate) {
      return null;
    }

    // Convert to USD first, then to target currency
    const amountInUsd = amount / fromRate;
    const result = amountInUsd * toRate;

    return result;
  }

  isCurrencyValid(currency: string): boolean {
    const rates = this.getCurrentRates();
    return currency.toUpperCase() in rates || currency.toUpperCase() === 'USD';
  }
}
