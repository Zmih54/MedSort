const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware аутентифікації.
 * Перевіряє JWT-токен із заголовка Authorization.
 */
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Доступ заборонено. Токен не надано'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Доступ заборонено. Токен не надано'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).populate('hospital', '_id name location');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Користувача з цим токеном не знайдено'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Недійсний токен'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Термін дії токена вичерпано'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Помилка аутентифікації'
    });
  }
};

/**
 * Middleware авторизації за ролями (RBAC).
 * Перевіряє, чи має користувач одну з дозволених ролей.
 * @param  {...string} roles - Дозволені ролі
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Спочатку необхідно пройти аутентифікацію'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Роль "${req.user.role}" не має доступу до цього ресурсу`
      });
    }

    next();
  };
};

module.exports = { auth, authorize };
