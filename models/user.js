const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'student' } // Default to 'student' role
});

module.exports = mongoose.model('User', userSchema);
