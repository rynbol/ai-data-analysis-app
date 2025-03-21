#!/bin/bash

# Functions for colored output
function log_info() {
  echo -e "\033[0;34m[INFO]\033[0m $1"
}

function log_success() {
  echo -e "\033[0;32m[SUCCESS]\033[0m $1"
}

function log_error() {
  echo -e "\033[0;31m[ERROR]\033[0m $1"
}

function log_warning() {
  echo -e "\033[0;33m[WARNING]\033[0m $1"
}

# Check that Python is installed
if ! command -v python3 &> /dev/null; then
    log_error "Python3 is not installed. Please install it and try again."
    exit 1
fi

# Check that Node.js is installed
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed. Please install it and try again."
    exit 1
fi

# Start Backend
log_info "Starting Flask Backend..."
cd backend || { log_error "Backend directory not found!"; exit 1; }

# Check if venv exists
if [ ! -d "venv" ]; then
    log_warning "Virtual environment not found. Creating one..."
    python3 -m venv venv || { log_error "Failed to create virtual environment"; exit 1; }
fi

# Activate virtual environment
source venv/bin/activate || { log_error "Failed to activate virtual environment"; exit 1; }

# Install dependencies if requirements.txt exists
if [ -f "requirements.txt" ]; then
    log_info "Installing Python dependencies..."
    pip install -r requirements.txt || log_warning "Some dependencies might not have installed correctly."
fi

# Start Flask server
log_info "Starting Flask server..."
python run.py &
BACKEND_PID=$!

# Wait for backend to start 
log_info "Waiting for backend to initialize..."
sleep 2

# Check if the backend started successfully by making a request to it
if curl -s http://localhost:5000/api/test > /dev/null; then
    log_success "Flask backend is running on http://localhost:5000"
else
    log_warning "Could not connect to Flask backend. It might not have started correctly."
    log_warning "Check backend logs for errors."
fi

# Start Frontend
log_info "Starting React Frontend..."
cd ../frontend || { log_error "Frontend directory not found!"; exit 1; }

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    log_warning "Node modules not found. Installing dependencies..."
    npm install || { log_error "Failed to install frontend dependencies"; exit 1; }
fi

# Start the frontend server
log_info "Starting Vite development server..."
npm run dev &
FRONTEND_PID=$!

# Check if frontend started successfully
sleep 3
if curl -s http://localhost:5173 > /dev/null; then
    log_success "React frontend is running on http://localhost:5173"
else
    log_warning "Could not connect to React frontend. It might not have started correctly."
    log_warning "Check frontend logs for errors."
fi

# Setup cleanup on exit
cleanup() {
  log_info "Shutting down servers..."
  kill $BACKEND_PID 2>/dev/null || log_warning "Backend process was not running."
  kill $FRONTEND_PID 2>/dev/null || log_warning "Frontend process was not running."
  log_success "Cleanup complete."
  exit 0
}

trap cleanup INT

# Keep script running
log_success "Both servers are running."
log_info "Open http://localhost:5173 in your browser to access the application."
log_warning "Press Ctrl+C to stop all servers."
wait 