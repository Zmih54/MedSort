const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const casualtiesRoutes = require('./routes/casualties');
const hospitalsRoutes = require('./routes/hospitals');
const reportsRoutes = require('./routes/reports');

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Маршрути API
app.use('/api/auth', authRoutes);
app.use('/api/casualties', casualtiesRoutes);
app.use('/api/hospitals', hospitalsRoutes);
app.use('/api/reports', reportsRoutes);

// Кореневий маршрут для перевірки стану сервера
app.get('/', (req, res) => {
  res.json({
    message: 'MedSort API працює',
    version: '1.0.0',
    endpoints: ['/api/auth', '/api/casualties', '/api/hospitals', '/api/reports']
  });
});

// Глобальна обробка помилок
app.use((err, req, res, next) => {
  console.error('Помилка сервера:', err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Внутрішня помилка сервера',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Обробка неіснуючих маршрутів
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Маршрут ${req.originalUrl} не знайдено`
  });
});

// Підключення до MongoDB та запуск сервера
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Підключено до MongoDB');
    app.listen(PORT, () => {
      console.log(`🚀 Сервер запущено на порту ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Помилка підключення до MongoDB:', err.message);
    process.exit(1);
  });

module.exports = app;
