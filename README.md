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

## Development & Deployment

### Prerequisites
- Node.js (version 18 or higher)
- npm

### Installation
```bash
npm install
```

### Web Development

#### Development Server
```bash
npm run start:web
```
Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

#### Build for Web
```bash
npm run build:web
```
The build artifacts will be stored in the `dist/text-calculator/` directory.

#### Running Tests
```bash
npm test
```

### Desktop Application (Electron)

#### Development Mode
Run the Angular dev server and Electron simultaneously:
```bash
npm run desktop
```
This will open the app in a desktop window and automatically reload on code changes.

#### Build for macOS
```bash
npm run dist:mac
```
The `.dmg` installer will be created in `release/mac-arm64/` (or `mac-x64/` depending on architecture).

#### Build for Windows
Run this command **on Windows** for native executable:
```bash
npm run dist:win
```
The `.exe` installer will be created in `release/win-unpacked/`.

**Note**: For best results, build Windows executables on Windows itself. Cross-compilation is supported but native building is recommended.

#### Distribution Details
- **macOS**: Creates a `.dmg` installer that can be shared and installed
- **Windows**: Creates an NSIS installer `.exe` with options for custom installation directory
- **Output**: All packages are built to the `release/` folder
- **App Name**: TypeCal

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
