const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

/**
 * Генерація JWT-токена.
 * @param {string} userId - ID користувача
 * @returns {string} JWT-токен
 */
function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
}

/**
 * POST /api/auth/register
 * Реєстрація нового користувача.
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, rank } = req.body;

    // Перевірка обов'язкових полів
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Ім'я, email та пароль є обов'язковими"
      });
    }

    // Перевірка чи користувач вже існує
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Користувач з таким email вже існує'
      });
    }

    // Створення користувача
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: role || 'combat_medic',
      rank
    });

    // Генерація токена
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Користувача успішно зареєстровано',
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          rank: user.rank
        }
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Користувач з таким email вже існує'
      });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join('. ')
      });
    }
    console.error('Помилка реєстрації:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка сервера при реєстрації'
    });
  }
});

/**
 * POST /api/auth/login
 * Аутентифікація користувача.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email та пароль є обов'язковими"
      });
    }

    // Знаходимо користувача з паролем
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Невірний email або пароль'
      });
    }

    // Перевірка пароля
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Невірний email або пароль'
      });
    }

    // Генерація токена
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Вхід виконано успішно',
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          rank: user.rank
        }
      }
    });
  } catch (error) {
    console.error('Помилка входу:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка сервера при вході'
    });
  }
});

/**
 * GET /api/auth/me
 * Отримання даних поточного авторизованого користувача.
 */
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Користувача не знайдено'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          rank: user.rank,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Помилка отримання профілю:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка сервера'
    });
  }
});


/**
 * GET /api/auth/users
 * Отримання списку всіх користувачів (тільки для адміністраторів).
 */
router.get('/users', auth, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error('Помилка отримання списку користувачів:', error);
    res.status(500).json({ success: false, message: 'Помилка сервера' });
  }
});

/**
 * PUT /api/auth/users/:id/role
 * Зміна ролі користувача (тільки для адміністраторів).
 */
router.put('/users/:id/role', auth, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['combat_medic', 'doctor', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Невірна роль' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Користувача не знайдено' });
    }
    res.json(user);
  } catch (error) {
    console.error('Помилка зміни ролі:', error);
    res.status(500).json({ success: false, message: 'Помилка сервера' });
  }
});

module.exports = router;
