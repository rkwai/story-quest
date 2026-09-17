import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Feature Flag Service - Manages feature flags for the application
 */
export class FeatureFlagService {
  private flags: Record<string, boolean>;

  constructor() {
    // Initialize flags from environment variables or defaults
    this.flags = {
      auth: true, // Authentication is always enabled
      campaigns: this.getBooleanFromEnv('FEATURE_CAMPAIGNS', true),
      characters: this.getBooleanFromEnv('FEATURE_CHARACTERS', true),
      items: this.getBooleanFromEnv('FEATURE_ITEMS', true),
      storyPosts: this.getBooleanFromEnv('FEATURE_STORY_POSTS', true),
      dmResponses: this.getBooleanFromEnv('FEATURE_DM_RESPONSES', true),
      // Add more features as needed
    };
  }

  /**
   * Get a boolean value from environment variable
   * @param key Environment variable key
   * @param defaultValue Default value if not found
   * @returns Boolean value
   */
  private getBooleanFromEnv(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
  }

  /**
   * Check if a feature is enabled
   * @param featureName Name of the feature
   * @returns True if feature is enabled, false otherwise
   */
  isEnabled(featureName: string): boolean {
    return this.flags[featureName] || false;
  }

  /**
   * Enable a feature
   * @param featureName Name of the feature
   */
  enable(featureName: string): void {
    this.flags[featureName] = true;
  }

  /**
   * Disable a feature
   * @param featureName Name of the feature
   */
  disable(featureName: string): void {
    // Don't allow disabling auth
    if (featureName === 'auth') return;
    this.flags[featureName] = false;
  }

  /**
   * Get all feature flags
   * @returns Record of all feature flags
   */
  getAllFlags(): Record<string, boolean> {
    return { ...this.flags };
  }
}

// Create and export the default feature flag service instance
const featureFlagService = new FeatureFlagService();

export default featureFlagService; 