# Contributing to System Monitor AI

First off, thanks for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to System Monitor AI.

## How Can I Contribute?

### Reporting Bugs
This section guides you through submitting a bug report.
- **Use a clear and descriptive title** for the issue to identify the problem.
- **Describe the exact steps which reproduce the problem** in as much detail as possible.
- **Provide specific examples** to demonstrate the steps.

### Suggesting Enhancements
- **Use a clear and descriptive title** for the issue to identify the suggestion.
- **Provide a step-by-step description of the suggested enhancement** in as much detail as possible.
- **Explain why this enhancement would be useful** to most users.

### Pull Requests
1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. Ensure the test suite passes.
4. Make sure your code lints.
5. Issue that pull request!

## Styleguides

### Git Commit Messages
- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

### JavaScript Styleguide
- We use modern ES6+ syntax.
- Prefer `async/await` over promises.
- Keep components small and focused.

## Project Structure
- `src/main`: Electron main process files (Node.js environment)
- `src/renderer`: Frontend UI files (Browser environment)
- `src/preload`: Preload scripts for IPC communication
