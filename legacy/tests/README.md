# StoryQuest Authentication Tests

This directory contains product-focused tests for the StoryQuest authentication feature. These tests are written using Cucumber.js for Behavior-Driven Development (BDD) and focus on ensuring that the authentication flows work correctly from a user's perspective.

## Test Structure

- `features/`: Contains Cucumber feature files that describe the behavior of the authentication system
  - `auth/`: Authentication-specific feature files
    - `registration.feature`: Tests for user registration
    - `login.feature`: Tests for user login
    - `profile.feature`: Tests for profile management
    - `authentication_persistence.feature`: Tests for session persistence
    - `password_security.feature`: Tests for password security features

- `step_definitions/`: Contains the implementation of the steps defined in the feature files
  - `auth/`: Authentication-specific step definitions
    - `auth_steps.ts`: Implementation of authentication steps

- `support/`: Contains support files for the tests
  - `world.ts`: Defines the World object that is shared between steps

## Running the Tests

To run all the authentication tests:

```bash
npm run test:features
```

To run a specific feature file:

```bash
npm run test:features -- tests/features/auth/registration.feature
```

## Test Implementation Details

These tests are designed to be product-focused rather than technical. They test the authentication flows from a user's perspective, ensuring that:

1. Users can register for a new account
2. Users can log in with valid credentials
3. Users cannot log in with invalid credentials
4. Users can view and update their profile information
5. Authentication persists appropriately across page refreshes and navigation
6. Password security features work correctly

The tests use a combination of API calls and browser automation (simulated in the current implementation) to test the authentication flows.

## Adding New Tests

To add a new test:

1. Create a new feature file in the `features/auth/` directory
2. Implement the steps in the `step_definitions/auth/auth_steps.ts` file
3. Run the tests to ensure they pass

## Future Improvements

- Integrate with a real browser automation tool like Puppeteer or Playwright
- Add more detailed assertions for UI elements
- Add tests for edge cases and error handling
- Integrate with CI/CD pipeline 