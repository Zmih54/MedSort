const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Ім'я є обов'язковим полем"],
      trim: true
    },
    email: {
      type: String,
      required: [true, "Email є обов'язковим полем"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Будь ласка, вкажіть коректний email']
    },
    password: {
      type: String,
      required: [true, "Пароль є обов'язковим полем"],
      minlength: [6, 'Пароль має містити щонайменше 6 символів'],
      select: false
    },
    role: {
      type: String,
      enum: {
        values: ['combat_medic', 'doctor', 'admin'],
        message: 'Роль {VALUE} не підтримується'
      },
      default: 'combat_medic'
    },
    rank: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Хешування пароля перед збереженням
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Метод порівняння пароля
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Прибираємо пароль із JSON-відповіді
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
