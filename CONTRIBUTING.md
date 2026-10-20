# Contributing to Celebrio AI

Thank you for your interest in contributing to **Celebrio AI**! We welcome contributions to enhance event planning capabilities, theme generators, and accessibility features.

## Development Workflow

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/mbajiya047/Celebrio-AI.git
   cd Celebrio-AI-main
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Add your GEMINI_API_KEY to .env
   ```

4. **Run Automated Test Suite & Coverage**:
   ```bash
   npm test
   npm run test:coverage
   ```

5. **Lint and Format Code**:
   ```bash
   npm run lint
   npm run format
   ```

6. **Start Development Server**:
   ```bash
   npm start
   ```

## Pull Request Guidelines

- Ensure all **69 automated tests** pass with `npm test`.
- Ensure code adheres to ESLint rules (`npm run lint` must pass with 0 errors/warnings).
- Adhere to WCAG 2.1 AA accessibility guidelines (proper ARIA attributes and high color contrast).
- Never commit real API keys or sensitive credentials.
