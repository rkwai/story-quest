# StoryQuest - Project Summary

## Overview

StoryQuest is a web-based D&D-inspired RPG with an LLM-powered Dungeon Master. The application allows users to create characters, embark on campaigns, and interact with an AI Dungeon Master that adapts to player choices and creates immersive storytelling experiences.

## Key Components

### Backend

- **Express.js Server**: RESTful API with TypeScript and strict type checking
- **PostgreSQL Database**: Relational database with Sequelize ORM
- **Authentication**: JWT-based authentication system
- **LLM Integration**: OpenAI GPT integration for the AI Dungeon Master
- **Feature Flags**: System to enable/disable features

### Frontend

- **React.js**: Component-based UI with TypeScript
- **Redux**: State management for the application
- **React Router**: Navigation between pages
- **Axios**: API requests to the backend

### Features

1. **User Authentication**
   - Registration and login
   - JWT-based authentication
   - User profiles

2. **Campaign Management**
   - Create and manage campaigns
   - Different campaign themes
   - Campaign status tracking

3. **Character Creation**
   - Create characters with different classes and races
   - Character stats and attributes
   - Character backstories

4. **AI Dungeon Master**
   - LLM-powered storytelling
   - Dynamic responses to player actions
   - Campaign introductions
   - Context-aware interactions

5. **Inventory System**
   - Item management
   - Character equipment

## Technical Highlights

1. **LLM Integration**
   - OpenAI API integration
   - Context management for coherent storytelling
   - System message templates for different scenarios

2. **Database Design**
   - Relational model with associations
   - Sequelize ORM for database operations
   - Seed script for initial data

3. **Security**
   - JWT authentication
   - Password hashing
   - Protected routes

4. **Code Organization**
   - Feature-based structure
   - Separation of concerns
   - Service-based architecture

## Running the Application

The application can be run using the provided `run.sh` script, which:
1. Checks if PostgreSQL is running
2. Installs all dependencies
3. Builds the application
4. Initializes the database
5. Starts both the backend and frontend servers

## Future Enhancements

1. **Advanced Character Progression**
   - Experience points and leveling
   - Skill trees and abilities

2. **Multiplayer Campaigns**
   - Multiple players in the same campaign
   - Real-time updates

3. **Enhanced AI Capabilities**
   - Memory of past interactions
   - Character personality modeling
   - Dynamic world building

4. **Mobile Application**
   - React Native implementation
   - Offline mode

5. **Voice Integration**
   - Text-to-speech for DM responses
   - Speech-to-text for player inputs 