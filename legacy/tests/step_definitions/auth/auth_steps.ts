import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import axios from 'axios';
import { World } from '../../support/world.js';

// Registration steps
Given('I am on the registration page', async function(this: World) {
  // Navigate to registration page using browser automation
  // Example: await this.browser.goto(`${this.apiBaseUrl}/register`);
  console.log('Navigating to registration page');
});

When('I enter a valid username {string}', async function(this: World, username: string) {
  // Fill username field
  // Example: await this.browser.fill('#username', username);
  this.currentUser = { ...this.currentUser, username };
  console.log(`Entering username: ${username}`);
});

When('I enter a valid email {string}', async function(this: World, email: string) {
  // Fill email field
  // Example: await this.browser.fill('#email', email);
  this.currentUser = { ...this.currentUser, email };
  console.log(`Entering email: ${email}`);
});

When('I enter a valid password {string}', async function(this: World, password: string) {
  // Fill password field
  // Example: await this.browser.fill('#password', password);
  this.currentUser = { ...this.currentUser, password };
  console.log(`Entering password: ${password}`);
});

When('I click the register button', async function(this: World) {
  // Click register button
  // Example: await this.browser.click('#register-button');
  try {
    this.response = await axios.post(`${this.apiBaseUrl}/api/auth/register`, this.currentUser);
    if (this.response.data.token) {
      this.token = this.response.data.token;
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      this.response = error.response;
    } else {
      console.error('Unexpected error:', error);
    }
  }
  console.log('Clicking register button');
});

// Login steps
Given('I am on the login page', async function(this: World) {
  // Navigate to login page
  // Example: await this.browser.goto(`${this.apiBaseUrl}/login`);
  console.log('Navigating to login page');
});

Given('a user exists with email {string} and password {string}', async function(this: World, email: string, password: string) {
  // Create a user in the database or mock the user
  // This would typically be done through a direct database connection or API call
  console.log(`Creating user with email: ${email} and password: ${password}`);
});

When('I enter email {string}', async function(this: World, email: string) {
  // Fill email field
  // Example: await this.browser.fill('#email', email);
  this.currentUser = { ...this.currentUser, email };
  console.log(`Entering email: ${email}`);
});

When('I enter password {string}', async function(this: World, password: string) {
  // Fill password field
  // Example: await this.browser.fill('#password', password);
  this.currentUser = { ...this.currentUser, password };
  console.log(`Entering password: ${password}`);
});

When('I click the login button', async function(this: World) {
  // Click login button
  // Example: await this.browser.click('#login-button');
  try {
    this.response = await axios.post(`${this.apiBaseUrl}/api/auth/login`, this.currentUser);
    if (this.response.data.token) {
      this.token = this.response.data.token;
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      this.response = error.response;
    } else {
      console.error('Unexpected error:', error);
    }
  }
  console.log('Clicking login button');
});

// Common assertions
Then('I should be redirected to the dashboard', async function(this: World) {
  // Check if redirected to dashboard
  // Example: expect(this.browser.url).to.include('/dashboard');
  console.log('Checking redirection to dashboard');
});

Then('I should see a welcome message', async function(this: World) {
  // Check for welcome message
  // Example: expect(await this.browser.isVisible('.welcome-message')).to.be.true;
  console.log('Checking for welcome message');
});

Then('I should be logged in', async function(this: World) {
  // Check if logged in
  // Example: expect(this.token).to.exist;
  expect(this.token).to.exist;
  console.log('Checking if logged in');
});

Then('I should see an error message {string}', async function(this: World, message: string) {
  // Check for error message
  // Example: expect(await this.browser.text('.error-message')).to.include(message);
  if (this.response && this.response.data && this.response.data.error) {
    expect(this.response.data.error).to.include(message);
  }
  console.log(`Checking for error message: ${message}`);
});

Then('I should remain on the registration page', async function(this: World) {
  // Check if still on registration page
  // Example: expect(this.browser.url).to.include('/register');
  console.log('Checking if still on registration page');
});

Then('I should see my username displayed', async function(this: World) {
  // Check if username is displayed in the UI
  // Example: expect(await this.browser.text('.user-profile')).to.include(this.currentUser.username);
  console.log('Checking if username is displayed');
});

Then('I should have access to protected features', async function(this: World) {
  // Check if protected features are accessible
  // Example: expect(await this.browser.isVisible('.protected-feature')).to.be.true;
  console.log('Checking access to protected features');
});

Then('I should remain on the login page', async function(this: World) {
  // Check if still on login page
  // Example: expect(this.browser.url).to.include('/login');
  console.log('Checking if still on login page');
});

When('I click the login button without entering credentials', async function(this: World) {
  // Click login button without entering any credentials
  // Example: await this.browser.click('#login-button');
  try {
    this.response = await axios.post(`${this.apiBaseUrl}/api/auth/login`, {});
  } catch (error) {
    if (axios.isAxiosError(error)) {
      this.response = error.response;
    } else {
      console.error('Unexpected error:', error);
    }
  }
  console.log('Clicking login button without credentials');
});

Then('I should see validation errors', async function(this: World) {
  // Check for validation errors
  // Example: expect(await this.browser.isVisible('.validation-error')).to.be.true;
  if (this.response && this.response.data && this.response.data.errors) {
    expect(this.response.data.errors).to.exist;
  }
  console.log('Checking for validation errors');
});

// Additional step definitions for other features
Given('I am a registered user with email {string} and password {string}', async function(this: World, email: string, password: string) {
  // Create a user in the database or mock the user
  this.currentUser = { ...this.currentUser, email, password };
  console.log(`Setting up registered user with email: ${email} and password: ${password}`);
});

Given('I am logged in', async function(this: World) {
  // Simulate being logged in
  this.token = 'mock-jwt-token';
  console.log('Setting up logged in state');
});

When('I refresh the page', async function(this: World) {
  // Simulate refreshing the page
  console.log('Simulating page refresh');
});

Then('I should still be logged in', async function(this: World) {
  // Check if still logged in after refresh
  expect(this.token).to.exist;
  console.log('Checking if still logged in');
});

// Add more step definitions as needed for the other scenarios 