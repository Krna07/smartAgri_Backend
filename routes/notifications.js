const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Shared in-memory store — also used by server.js MQTT handler
const getStore = (userId) => {
  if (!global.notifStore) global.notifStore = {};
  if (!global.notifStore[userId]) global.notifStore[userId] = [];
  return global.notifStore[userId];
};

router.get('/', auth, (req, res) => {
  res.json(getStore(String(req.user._id)));
});

router.post('/', auth, (req, res) => {
  const uid = String(req.user._id);
  const n = {
    id: Date.now(),
    message: req.body.message,
    type: req.body.type || 'info',
    plantRow: req.body.plantRow,
    timestamp: new Date(),
    read: false
  };
  const list = getStore(uid);
  list.unshift(n);
  if (list.length > 100) list.splice(100);
  req.app.get('io').to(`user_${uid}`).emit('newNotification', n);
  res.json(n);
});

router.patch('/:id/read', auth, (req, res) => {
  const list = getStore(String(req.user._id));
  const n = list.find(x => x.id == req.params.id);
  if (!n) return res.status(404).json({ message: 'Not found' });
  n.read = true;
  res.json(n);
});

module.exports = router;
