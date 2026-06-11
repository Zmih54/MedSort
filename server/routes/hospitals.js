const express = require('express');
const Hospital = require('../models/Hospital');
const CasualtyCard = require('../models/CasualtyCard');
const { auth, authorize } = require('../middleware/auth');
const { recommendHospitals } = require('../services/routing');

const router = express.Router();

// Усі маршрути захищені аутентифікацією
router.use(auth);

/**
 * GET /api/hospitals
 * Отримання списку всіх госпіталів.
 *
 * Query параметри:
 *   - active: фільтр за активністю (true/false)
 *   - specialization: фільтр за спеціалізацією
 */
router.get('/', async (req, res) => {
  try {
    const { active, specialization } = req.query;
    const filter = {};

    if (active !== undefined) {
      filter.isActive = active === 'true';
    }

    if (specialization) {
      filter.specializations = specialization;
    }

    const hospitals = await Hospital.find(filter).sort({ name: 1 });

    res.json({
      success: true,
      data: {
        hospitals,
        total: hospitals.length
      }
    });
  } catch (error) {
    console.error('Помилка отримання госпіталів:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка сервера при отриманні списку госпіталів'
    });
  }
});

/**
 * GET /api/hospitals/:id
 * Отримання окремого госпіталю.
 */
router.get('/:id', async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);

    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Госпіталь не знайдено'
      });
    }

    res.json({
      success: true,
      data: { hospital }
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ success: false, message: 'Невірний формат ID' });
    }
    console.error('Помилка отримання госпіталю:', error);
    res.status(500).json({ success: false, message: 'Помилка сервера' });
  }
});

/**
 * POST /api/hospitals
 * Створення нового госпіталю (тільки адміністратор).
 */
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const {
      name,
      location,
      coordinates,
      specializations,
      totalCapacity,
      currentLoad,
      distance,
      contactPhone,
      isActive
    } = req.body;

    if (!name || totalCapacity === undefined) {
      return res.status(400).json({
        success: false,
        message: "Назва та загальна місткість є обов'язковими"
      });
    }

    const hospital = await Hospital.create({
      name,
      location,
      coordinates,
      specializations: specializations || [],
      totalCapacity,
      currentLoad: currentLoad || 0,
      distance,
      contactPhone,
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json({
      success: true,
      message: 'Госпіталь створено',
      data: { hospital }
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join('. ') });
    }
    console.error('Помилка створення госпіталю:', error);
    res.status(500).json({ success: false, message: 'Помилка сервера' });
  }
});

/**
 * PUT /api/hospitals/:id
 * Оновлення госпіталю.
 */
router.put('/:id', async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);

    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Госпіталь не знайдено'
      });
    }

    const allowedFields = [
      'name', 'location', 'coordinates', 'specializations',
      'totalCapacity', 'currentLoad', 'distance', 'contactPhone', 'isActive'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        hospital[field] = req.body[field];
      }
    }

    await hospital.save();

    res.json({
      success: true,
      message: 'Госпіталь оновлено',
      data: { hospital }
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ success: false, message: 'Невірний формат ID' });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join('. ') });
    }
    console.error('Помилка оновлення госпіталю:', error);
    res.status(500).json({ success: false, message: 'Помилка сервера' });
  }
});

/**
 * DELETE /api/hospitals/:id
 * Видалення госпіталю (тільки адміністратор).
 */
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);

    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Госпіталь не знайдено'
      });
    }

    // Знімаємо прив'язку лікарні з усіх карток поранених
    await CasualtyCard.updateMany(
      { assignedHospital: req.params.id },
      { $unset: { assignedHospital: '' } }
    );

    await Hospital.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Госпіталь видалено'
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ success: false, message: 'Невірний формат ID' });
    }
    console.error('Помилка видалення госпіталю:', error);
    res.status(500).json({ success: false, message: 'Помилка сервера' });
  }
});

/**
 * POST /api/hospitals/recommend
 * Рекомендація госпіталів для конкретного пораненого.
 *
 * Body: { casualtyId: string }
 */
router.post('/recommend', async (req, res) => {
  try {
    const { casualtyId } = req.body;

    if (!casualtyId) {
      return res.status(400).json({
        success: false,
        message: "ID пораненого є обов'язковим"
      });
    }

    const casualty = await CasualtyCard.findById(casualtyId);

    if (!casualty) {
      return res.status(404).json({
        success: false,
        message: 'Картку пораненого не знайдено'
      });
    }

    const hospitals = await Hospital.find({ isActive: true });

    if (hospitals.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Активних госпіталів не знайдено'
      });
    }

    const recommendations = recommendHospitals(casualty, hospitals);

    res.json({
      success: true,
      message: `Знайдено ${recommendations.length} рекомендацій`,
      data: {
        casualtyId: casualty._id,
        patientName: `${casualty.patientData?.lastName || ''} ${casualty.patientData?.firstName || ''}`.trim(),
        triageCategory: casualty.triageCategory,
        recommendations
      }
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ success: false, message: 'Невірний формат ID' });
    }
    console.error('Помилка рекомендації госпіталів:', error);
    res.status(500).json({ success: false, message: 'Помилка сервера' });
  }
});

module.exports = router;
