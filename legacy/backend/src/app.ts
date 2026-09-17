import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './shared/db/connection';
import featureFlagService from './shared/services/featureFlags.service';

// Import routes from feature modules
import authRoutes from './features/auth/auth.routes';

// Conditionally import other routes based on feature flags
let campaignRoutes, characterRoutes, storyPostRoutes, itemRoutes, dmResponsesRoutes;

// Load environment variables
dotenv.config();

// Initialize Express app
const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test database connection
testConnection().catch(err => {
  console.error('Database connection failed:', err);
  process.exit(1);
});

// Define routes
app.use('/api/auth', authRoutes);

// Conditionally register routes based on feature flags
if (featureFlagService.isEnabled('campaigns')) {
  campaignRoutes = require('./features/campaigns/campaigns.routes').default;
  app.use('/api/campaigns', campaignRoutes);
}

if (featureFlagService.isEnabled('characters')) {
  characterRoutes = require('./features/characters/characters.routes').default;
  app.use('/api/characters', characterRoutes);
}

if (featureFlagService.isEnabled('storyPosts')) {
  storyPostRoutes = require('./features/storyPosts/storyPosts.routes').default;
  app.use('/api/campaigns', storyPostRoutes); // /api/campaigns/:id/story
}

if (featureFlagService.isEnabled('items')) {
  itemRoutes = require('./features/items/items.routes').default;
  app.use('/api/items', itemRoutes);
}

if (featureFlagService.isEnabled('dmResponses')) {
  dmResponsesRoutes = require('./features/dmResponses/dmResponses.routes').default;
  app.use('/api/campaigns', dmResponsesRoutes); // /api/campaigns/:id/dm-response
}

// Feature flags endpoint
app.get('/api/features', (_req: Request, res: Response) => {
  res.status(200).json(featureFlagService.getAllFlags());
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

export default app; 