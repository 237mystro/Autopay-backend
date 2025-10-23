// backend/server.js (add Socket.IO integration)
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/error');
const { initializeSocket } = require('./socket');
const http = require('http');
const path = require('path');

// Load env vars
dotenv.config({ path: './.env' });

// Connect to database
connectDB();

// Route files
const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const messageRoutes = require('./routes/messageRoutes');

const app = express();

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io available to routes
app.set('io', io);

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Set security headers
app.use(helmet());

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount routers
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/messages', require('./routes/announcementRoutes'));

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Initialize Socket.IO
initializeSocket(io);

server.listen(
  PORT,
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});