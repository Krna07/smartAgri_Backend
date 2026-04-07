const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
const allowedOrigins = [FRONTEND_URL, 'http://localhost:3001', 'http://localhost:3000', 'https://localhost', 'capacitor://localhost', 'ionic://localhost'];

const io = socketIo(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] }
});

app.use(cors({ origin: allowedOrigins }));
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

// Keep-alive ping to prevent Render free tier from sleeping
setInterval(() => {
  const http = require('http');
  const url = process.env.RENDER_EXTERNAL_URL;
  if (url) http.get(url).on('error', () => {});
}, 14 * 60 * 1000); // every 14 minutes

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
