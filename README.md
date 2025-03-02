# StoryQuest

StoryQuest is a web-based D&D-inspired RPG with an LLM-powered Dungeon Master. Create characters, embark on campaigns, and interact with an AI Dungeon Master that adapts to your choices and creates immersive storytelling experiences.

## Features

- **AI Dungeon Master**: Interact with an LLM-powered DM that creates dynamic and responsive storytelling
- **Character Creation**: Build unique characters with different classes, attributes, and backstories
- **Campaign Management**: Create and manage multiple campaigns with different themes
- **Inventory System**: Collect and manage items throughout your adventures
- **User Authentication**: Secure login and registration system

## Tech Stack

### Backend
- Node.js with Express.js
- PostgreSQL database with Sequelize ORM
- JWT authentication
- OpenAI API integration for the AI Dungeon Master

### Frontend
- React.js with TypeScript
- Redux for state management
- React Router for navigation
- Axios for API requests

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v14 or v15)
- OpenAI API key

### PostgreSQL Version Compatibility

StoryQuest works with PostgreSQL versions 14 and 15. If you're using a different version, you may need to adjust the connection settings in `backend/.env`.

If you're using PostgreSQL 15 with Homebrew on macOS, you can start it with:

```bash
brew services start postgresql@15
```

For PostgreSQL 14:

```bash
brew services start postgresql@14
```

On Linux, you can use:

```bash
sudo service postgresql start
```

### Quick Start

The easiest way to get started is to use the provided run script:

```bash
# Make the script executable (if not already)
chmod +x run.sh

# Run the application
./run.sh
```

This script will:
1. Check if PostgreSQL is running
2. Install all dependencies
3. Build the application
4. Initialize the database
5. Start both the backend and frontend servers

### Manual Installation

If you prefer to install manually:

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/story-quest.git
   cd story-quest
   ```

2. Install dependencies:
   ```
   npm run install:all
   ```

3. Set up environment variables:
   
   Create a `.env` file in the `backend` directory with the following variables:
   ```
   PORT=4000
   NODE_ENV=development
   
   # Database
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=storyquest
   DB_USER=postgres
   DB_PASSWORD=yourpassword
   
   # JWT
   JWT_SECRET=your_jwt_secret
   JWT_EXPIRES_IN=7d
   
   # OpenAI
   OPENAI_API_KEY=your_openai_api_key
   OPENAI_MODEL=gpt-4o
   OPENAI_MAX_TOKENS=500
   OPENAI_TEMPERATURE=0.8
   ```

4. Initialize the database:
   ```
   cd backend
   npm run seed
   ```

5. Start the development servers:
   ```
   cd ..
   npm run dev:all
   ```

   This will start both the backend server (on port 4000) and the frontend development server (on port 3000).

## Usage

1. Register a new account or log in
2. Create a new campaign by selecting a theme and providing a description
3. Create a character for your campaign
4. Start interacting with the AI Dungeon Master
5. Respond to the DM's prompts and shape your adventure

## Project Structure

```
story-quest/
├── backend/                # Backend code
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Sequelize models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Utility functions
│   │   ├── db/             # Database configuration
│   │   └── index.ts        # Entry point
│   ├── tests/              # Backend tests
│   └── package.json
├── frontend/               # Frontend code
│   ├── public/             # Static files
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── redux/          # Redux store, actions, reducers
│   │   ├── services/       # API services
│   │   ├── utils/          # Utility functions
│   │   ├── App.tsx         # Main App component
│   │   └── index.tsx       # Entry point
│   ├── tests/              # Frontend tests
│   └── package.json
└── package.json            # Root package.json
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login a user
- `GET /api/auth/profile` - Get current user profile

### Campaigns
- `GET /api/campaigns` - Get all campaigns for the current user
- `POST /api/campaigns` - Create a new campaign
- `GET /api/campaigns/:id` - Get a specific campaign
- `PUT /api/campaigns/:id` - Update a campaign
- `DELETE /api/campaigns/:id` - Delete a campaign

### Characters
- `GET /api/campaigns/:id/characters` - Get all characters for a campaign
- `POST /api/characters` - Create a new character
- `GET /api/characters/:id` - Get a specific character
- `PUT /api/characters/:id` - Update a character
- `DELETE /api/characters/:id` - Delete a character

### Story Posts
- `GET /api/campaigns/:id/story-posts` - Get all story posts for a campaign
- `POST /api/campaigns/:id/story-posts` - Create a new story post
- `DELETE /api/story-posts/:id` - Delete a story post

### DM Responses
- `POST /api/campaigns/:id/dm-response` - Generate a DM response
- `POST /api/campaigns/:id/introduction` - Generate a campaign introduction

### Items
- `GET /api/characters/:id/items` - Get all items for a character
- `POST /api/items` - Create a new item
- `PUT /api/items/:id` - Update an item
- `DELETE /api/items/:id` - Delete an item

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Troubleshooting

### PostgreSQL Connection Issues

If you encounter PostgreSQL connection issues:

1. **Check if PostgreSQL is running**:
   ```bash
   # For macOS with Homebrew
   brew services list
   
   # For Linux
   sudo service postgresql status
   ```

2. **Verify your PostgreSQL version**:
   ```bash
   psql --version
   ```

3. **Update connection settings**:
   If you're using a different PostgreSQL version or configuration, update the connection settings in `backend/.env`.

4. **Create the database manually**:
   ```bash
   createdb -h localhost -p 5432 -U your_username storyquest
   ```

5. **Check database permissions**:
   Make sure your user has permission to create and access the database.

### Application Startup Issues

1. **Port conflicts**:
   If port 4000 (backend) or 3000 (frontend) is already in use, you can change the ports in:
   - Backend: `backend/.env` (PORT variable)
   - Frontend: `frontend/package.json` (proxy setting)

2. **Dependency issues**:
   If you encounter dependency issues, try:
   ```bash
   npm run install:all
   ```

3. **Build errors**:
   If you encounter build errors, check the console output for specific errors and make sure you have the correct Node.js version.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OpenAI for providing the GPT models that power the AI Dungeon Master
- The D&D community for inspiration 