const { setWorldConstructor } = require('@cucumber/cucumber');

class CustomWorld {
  constructor({ attach, parameters }) {
    this.attach = attach;
    this.parameters = parameters;
    
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