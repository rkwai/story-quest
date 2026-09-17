#!/bin/bash

# StoryQuest Run Script

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}StoryQuest - D&D-inspired RPG with LLM-powered Dungeon Master${NC}"
echo "========================================================"

# Check PostgreSQL version
if command -v psql > /dev/null; then
  PG_VERSION=$(psql --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
  echo -e "${GREEN}PostgreSQL version ${PG_VERSION} found.${NC}"
else
  echo -e "${YELLOW}PostgreSQL command-line tools not found. Will try to connect anyway.${NC}"
fi

# Check if PostgreSQL is running (more flexible version check)
echo -e "${YELLOW}Checking PostgreSQL...${NC}"

# Try different methods to check if PostgreSQL is running
pg_running=false

# Method 1: Check using pg_isready
if pg_isready > /dev/null 2>&1; then
  pg_running=true
fi

# Method 2: Check using ps
if ! $pg_running; then
  if ps aux | grep -v grep | grep postgres > /dev/null; then
    pg_running=true
  fi
fi

# Method 3: Check using brew services (macOS)
if ! $pg_running && command -v brew > /dev/null; then
  if brew services list | grep postgresql | grep started > /dev/null; then
    pg_running=true
  fi
fi

if $pg_running; then
  echo -e "${GREEN}PostgreSQL is running.${NC}"
else
  echo -e "${YELLOW}PostgreSQL service not detected. Attempting to start...${NC}"
  
  # Try to start PostgreSQL using different methods
  if command -v brew > /dev/null; then
    # Try PostgreSQL 15
    echo -e "${YELLOW}Trying to start PostgreSQL 15...${NC}"
    brew services start postgresql@15 > /dev/null 2>&1
    
    # If that fails, try PostgreSQL 14
    if ! pg_isready > /dev/null 2>&1; then
      echo -e "${YELLOW}Trying to start PostgreSQL 14...${NC}"
      brew services start postgresql@14 > /dev/null 2>&1
    fi
    
    # Check if it's running now
    if pg_isready > /dev/null 2>&1; then
      echo -e "${GREEN}PostgreSQL started successfully.${NC}"
      pg_running=true
    fi
  elif command -v service > /dev/null; then
    # Try to start using service (Linux)
    echo -e "${YELLOW}Trying to start PostgreSQL using service...${NC}"
    sudo service postgresql start > /dev/null 2>&1
    
    # Check if it's running now
    if pg_isready > /dev/null 2>&1; then
      echo -e "${GREEN}PostgreSQL started successfully.${NC}"
      pg_running=true
    fi
  fi
  
  # If still not running, exit
  if ! $pg_running; then
    echo -e "${RED}PostgreSQL is not running. Please start PostgreSQL and try again.${NC}"
    echo -e "${YELLOW}You can try:${NC}"
    echo -e "  - brew services start postgresql@15"
    echo -e "  - brew services start postgresql@14"
    echo -e "  - sudo service postgresql start (Linux)"
    echo -e "  - pg_ctl -D /usr/local/var/postgres start"
    exit 1
  fi
fi

# Check if database exists and create it if it doesn't
echo -e "${YELLOW}Checking database...${NC}"
DB_NAME=$(grep DB_NAME backend/.env | cut -d '=' -f2)
DB_USER=$(grep DB_USER backend/.env | cut -d '=' -f2)
DB_PASSWORD=$(grep DB_PASSWORD backend/.env | cut -d '=' -f2)
DB_HOST=$(grep DB_HOST backend/.env | cut -d '=' -f2)
DB_PORT=$(grep DB_PORT backend/.env | cut -d '=' -f2)

# Set defaults if not found
DB_NAME=${DB_NAME:-storyquest}
DB_USER=${DB_USER:-postgres}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

# Check if database exists
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
  echo -e "${GREEN}Database $DB_NAME exists.${NC}"
else
  echo -e "${YELLOW}Database $DB_NAME does not exist. Creating...${NC}"
  createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Database $DB_NAME created successfully.${NC}"
  else
    echo -e "${RED}Failed to create database $DB_NAME. You may need to create it manually.${NC}"
    echo -e "${YELLOW}Try: createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME${NC}"
  fi
fi

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install

# Install backend dependencies
echo -e "${YELLOW}Installing backend dependencies...${NC}"
cd backend && npm install && cd ..

# Install frontend dependencies with legacy peer deps
echo -e "${YELLOW}Installing frontend dependencies...${NC}"
cd frontend && npm install --legacy-peer-deps && cd ..

# Check if backend port is already in use
echo -e "${YELLOW}Checking if backend port is already in use...${NC}"
if curl -s http://localhost:4000/api/health > /dev/null; then
  echo -e "${GREEN}Backend server is already running on port 4000.${NC}"
  BACKEND_RUNNING=true
else
  BACKEND_RUNNING=false
  # Start the backend server
  echo -e "${YELLOW}Starting the backend server...${NC}"
  cd backend && node simple-server.js &
  BACKEND_PID=$!
  cd ..
  echo -e "${GREEN}Backend server started with PID $BACKEND_PID${NC}"
  
  # Wait for backend to start
  echo -e "${YELLOW}Waiting for backend to start...${NC}"
  sleep 5
  
  # Check if backend is running
  if curl -s http://localhost:4000/api/health > /dev/null; then
    echo -e "${GREEN}Backend server is running.${NC}"
  else
    echo -e "${RED}Backend server failed to start. Check the logs for errors.${NC}"
    kill $BACKEND_PID
    exit 1
  fi
fi

# Check if frontend port is already in use
echo -e "${YELLOW}Checking if frontend port is already in use...${NC}"
if curl -s http://localhost:3000 > /dev/null; then
  echo -e "${GREEN}Frontend server is already running on port 3000.${NC}"
  FRONTEND_RUNNING=true
else
  FRONTEND_RUNNING=false
  # Start the frontend server
  echo -e "${YELLOW}Starting the frontend server...${NC}"
  # Debug current directory
  echo -e "${YELLOW}Current directory: $(pwd)${NC}"
  # Make sure we're in the root directory before accessing frontend
  cd "$(dirname "$0")"
  if [ -d "./frontend" ]; then
    echo -e "${GREEN}Frontend directory found.${NC}"
    cd frontend && npm start &
    FRONTEND_PID=$!
    cd ..
  else
    echo -e "${RED}Frontend directory not found. Looking for it...${NC}"
    # Try to find the frontend directory
    FRONTEND_DIR=$(find "$(pwd)" -type d -name "frontend" -maxdepth 2 | head -n 1)
    if [ -n "$FRONTEND_DIR" ]; then
      echo -e "${GREEN}Frontend directory found at: $FRONTEND_DIR${NC}"
      cd "$FRONTEND_DIR" && npm start &
      FRONTEND_PID=$!
      cd - > /dev/null
    else
      echo -e "${RED}Could not find frontend directory. Frontend will not be started.${NC}"
      FRONTEND_PID=""
    fi
  fi
  
  if [ -n "$FRONTEND_PID" ]; then
    echo -e "${GREEN}Frontend server started with PID $FRONTEND_PID${NC}"
    
    # Wait for frontend to start
    echo -e "${YELLOW}Waiting for frontend to start...${NC}"
    sleep 10
    
    # Check if frontend is running
    if curl -s http://localhost:3000 > /dev/null; then
      echo -e "${GREEN}Frontend server is running.${NC}"
    else
      echo -e "${YELLOW}Frontend server might still be starting up. Please check manually in a moment.${NC}"
    fi
  fi
fi

echo -e "${GREEN}StoryQuest is now running!${NC}"
echo -e "${YELLOW}Backend API: http://localhost:4000${NC}"
echo -e "${YELLOW}Frontend App: http://localhost:3000${NC}"
echo -e "${YELLOW}To stop the servers, press Ctrl+C${NC}"

# Function to clean up processes on exit
cleanup() {
  echo -e "${YELLOW}Shutting down servers...${NC}"
  if [ "$BACKEND_RUNNING" = false ] && [ -n "$BACKEND_PID" ]; then
    kill $BACKEND_PID 2>/dev/null
  fi
  if [ "$FRONTEND_RUNNING" = false ] && [ -n "$FRONTEND_PID" ]; then
    kill $FRONTEND_PID 2>/dev/null
  fi
  echo -e "${GREEN}Servers stopped.${NC}"
  exit 0
}

# Set up trap to catch Ctrl+C and other termination signals
trap cleanup SIGINT SIGTERM

# Keep the script running
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
wait 