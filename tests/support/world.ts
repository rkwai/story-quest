import { setWorldConstructor, World as CucumberWorld, IWorldOptions } from '@cucumber/cucumber';

export interface World extends CucumberWorld {
  apiBaseUrl: string;
  currentUser: any;
  response: any;
  token: string;
  browser: any; // This would be a browser automation tool like Puppeteer or Playwright
}

class CustomWorld extends CucumberWorld implements World {
  apiBaseUrl: string;
  currentUser: any;
  response: any;
  token: string;
  browser: any;

  constructor(options: IWorldOptions) {
    super(options);
    
    // Initialize properties
    this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    this.currentUser = {};
    this.response = null;
    this.token = '';
    this.browser = null; // In a real implementation, this would be initialized with a browser automation tool
  }

  // Add helper methods as needed
  async resetState() {
    this.currentUser = {};
    this.response = null;
    this.token = '';
  }
}

setWorldConstructor(CustomWorld); 