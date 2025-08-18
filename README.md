# Text Calculator

A modern text-based calculator application built with Angular, similar to the Numi app. This calculator allows you to type mathematical expressions in natural language and see real-time results.

## Features

- **Text-based input**: Type mathematical expressions naturally
- **Real-time evaluation**: See results as you type
- **Mathematical functions**: Support for basic arithmetic, trigonometry, and more
- **Clean interface**: Modern, responsive design
- **Error handling**: Graceful handling of invalid expressions

## Supported Operations

### Basic Arithmetic
- Addition: `+`
- Subtraction: `-`
- Multiplication: `*`
- Division: `/`
- Exponentiation: `^`

### Mathematical Functions
- Square root: `sqrt()`
- Trigonometric: `sin()`, `cos()`, `tan()`
- Logarithms: `log()`, `ln()`
- Absolute value: `abs()`

### Constants
- Pi: `pi`
- Euler's number: `e`

## Examples

```
Calculate the area of a circle with radius 5
3.14159 * 5^2

Convert 100 fahrenheit to celsius  
(100 - 32) * 5/9

Calculate compound interest
1000 * (1 + 0.05)^10

Basic calculations
15 + 25 * 2
sqrt(144)
sin(45 * pi/180)
```

## Development

### Prerequisites
- Node.js (version 18 or higher)
- npm

### Installation
```bash
npm install
```

### Development Server
```bash
npm start
```
Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

### Build
```bash
npm run build
```
The build artifacts will be stored in the `dist/` directory.

### Running Tests
```bash
npm test
```

## Project Structure

```
src/
├── app/
│   ├── calculator/           # Main calculator component
│   │   ├── calculator.component.ts
│   │   ├── calculator.component.html
│   │   └── calculator.component.scss
│   ├── app.component.ts      # Root component
│   ├── app.module.ts         # App module
│   └── app-routing.module.ts # Routing configuration
├── styles.scss               # Global styles
├── index.html                # Main HTML file
└── main.ts                   # Application entry point
```

## Technology Stack

- **Angular 16**: Frontend framework
- **TypeScript**: Programming language
- **SCSS**: Styling
- **Custom Math Evaluator**: Secure expression evaluation without external dependencies

## Security

The calculator uses a custom mathematical expression evaluator that:
- Validates input to prevent code injection
- Only allows mathematical operations and functions
- Sanitizes expressions before evaluation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).
