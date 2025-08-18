// Type declaration override for mathjs compatibility
declare module 'mathjs' {
  const mathjs: any;
  export = mathjs;
}

declare module 'fraction.js' {
  class Fraction {
    constructor(n: number | string, d?: number);
    toString(): string;
    valueOf(): number;
  }
  export = Fraction;
}
