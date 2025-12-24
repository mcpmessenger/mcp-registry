# Contributing to MCP Registry

Thank you for your interest in contributing to MCP Registry! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect different viewpoints and experiences

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/mcpmessenger/mcp-registry/issues)
2. If not, create a new issue with:
   - A clear, descriptive title
   - Steps to reproduce the bug
   - Expected vs. actual behavior
   - Screenshots (if applicable)
   - Environment details (OS, Node version, etc.)

### Suggesting Features

1. Check if the feature has already been suggested
2. Create a new issue with:
   - A clear description of the feature
   - Use cases and benefits
   - Possible implementation approach (if you have ideas)

### Pull Requests

1. **Fork the repository**
   ```bash
   git clone https://github.com/your-username/mcp-registry.git
   cd mcp-registry
   ```

2. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

3. **Make your changes**
   - Write clean, readable code
   - Follow existing code style and conventions
   - Add comments for complex logic
   - Update documentation if needed

4. **Test your changes**
   - Test frontend changes: `pnpm dev`
   - Test backend changes: `cd backend && npm start`
   - Ensure both work together

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add: description of your changes"
   ```
   Use clear, descriptive commit messages:
   - `Add:` for new features
   - `Fix:` for bug fixes
   - `Update:` for updates to existing features
   - `Refactor:` for code refactoring
   - `Docs:` for documentation changes

6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Open a Pull Request**
   - Provide a clear title and description
   - Reference any related issues
   - Include screenshots for UI changes

## Development Guidelines

### Code Style

- **TypeScript**: Use TypeScript for type safety
- **Formatting**: Follow existing code formatting
- **Naming**: Use descriptive variable and function names
- **Comments**: Add comments for complex logic

### Frontend Guidelines

- Use React best practices
- Follow Next.js conventions
- Use TypeScript types from `types/` directory
- Keep components modular and reusable
- Use Tailwind CSS for styling

### Backend Guidelines

- Follow Express.js best practices
- Use Prisma for database operations
- Add proper error handling
- Validate input data
- Use environment variables for configuration

### Testing

- Test your changes thoroughly
- Ensure existing functionality still works
- Test edge cases

## Project Structure

- `app/` - Next.js pages and routes
- `components/` - React components
- `backend/` - Express.js API server
- `types/` - TypeScript type definitions
- `lib/` - Utility functions

## Getting Help

- Open an issue for questions
- Check existing documentation
- Review existing code for examples

## License

By contributing, you agree that your contributions will be licensed under the ISC License.

Thank you for contributing to MCP Registry! 🎉







