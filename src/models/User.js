const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['client', 'owner', 'admin'],
      required: true,
    },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    telegram: { type: String, trim: true, default: '' },
    passwordHash: { type: String, required: true },
    isEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre('validate', function (next) {
  if (this.role === 'owner' && !this.telegram) {
    next(new Error('Telegram is required for venue owners'));
  } else {
    next();
  }
});

module.exports = mongoose.model('User', userSchema);
