// backend/socket.js
const Message = require('./models/Message');
const User = require('./models/User');

const initializeSocket = (io) => {
  // Store connected users
  const connectedUsers = new Map();

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Authenticate user
    socket.on('authenticate', async (token) => {
      try {
        // In a real app, verify JWT token here
        // For demo, we'll just store the user ID
        const userId = token; // This should be the decoded user ID from JWT
        connectedUsers.set(socket.id, userId);
        socket.userId = userId;
        
        // Join user room
        socket.join(`user_${userId}`);
        
        // Join company room
        const user = await User.findById(userId);
        if (user) {
          socket.join(`company_${user.company}`);
          
          // Notify others in company that user is online
          socket.to(`company_${user.company}`).emit('user:online', {
            userId,
            name: user.name
          });
        }
        
        console.log(`User ${userId} authenticated and joined rooms`);
      } catch (err) {
        console.error('Socket authentication error:', err);
        socket.disconnect();
      }
    });

    // Handle typing indicator
    socket.on('typing:start', (data) => {
      const { receiverId } = data;
      socket.to(`user_${receiverId}`).emit('typing:start', {
        senderId: socket.userId
      });
    });

    socket.on('typing:stop', (data) => {
      const { receiverId } = data;
      socket.to(`user_${receiverId}`).emit('typing:stop', {
        senderId: socket.userId
      });
    });

    // Handle message sending
    socket.on('message:send', async (data) => {
      try {
        const { receiverId, content, fileUrl, fileName, fileType } = data;
        
        // In a real app, validate and save message to database
        // For demo, we'll just emit it to the receiver
        
        // Emit to receiver
        io.to(`user_${receiverId}`).emit('message:receive', {
          message: {
            _id: Date.now().toString(),
            sender: socket.userId,
            receiver: receiverId,
            content,
            fileUrl,
            fileName,
            fileType,
            createdAt: new Date(),
            isAnnouncement: false
          },
          sender: {
            id: socket.userId,
            name: 'Current User' // Would come from database in real app
          }
        });
        
        console.log(`Message sent from ${socket.userId} to ${receiverId}`);
      } catch (err) {
        console.error('Socket message send error:', err);
      }
    });

    // Handle announcement sending
    socket.on('announcement:send', async (data) => {
      try {
        const { companyId, content, fileUrl, fileName, fileType } = data;
        
        // In a real app, validate and save announcement to database
        // For demo, we'll just emit it to the company room
        
        // Emit to company room
        io.to(`company_${companyId}`).emit('announcement:receive', {
          announcement: {
            _id: Date.now().toString(),
            sender: socket.userId,
            content,
            fileUrl,
            fileName,
            fileType,
            createdAt: new Date(),
            isAnnouncement: true
          },
          sender: {
            id: socket.userId,
            name: 'Admin User' // Would come from database in real app
          }
        });
        
        console.log(`Announcement sent to company ${companyId}`);
      } catch (err) {
        console.error('Socket announcement send error:', err);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      const userId = connectedUsers.get(socket.id);
      if (userId) {
        connectedUsers.delete(socket.id);
        console.log(`User ${userId} disconnected`);
        
        // Notify others in company that user is offline
        // In a real app, you'd get the company ID from the user
      }
    });
  });

  return io;
};

module.exports = { initializeSocket };