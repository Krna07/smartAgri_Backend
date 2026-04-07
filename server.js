const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

const io = socketIo(server, {
  cors: { origin: [FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001'], methods: ['GET', 'POST'] }
});

app.use(cors({ origin: [FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001'] }));
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/irrigation', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/sensors', require('./routes/sensors'));
app.use('/api/irrigation', require('./routes/irrigation'));
app.use('/api/notifications', require('./routes/notifications'));

// Each authenticated client joins their own room
io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`Socket joined room user_${userId}`);
  });
  socket.on('disconnect', () => {});
});

app.set('io', io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
