const express = require('express');
const CasualtyCard = require('../models/CasualtyCard');
const { auth, authorize } = require('../middleware/auth');
const { runTriageForPatient } = require('../services/triageAHP');

const router = express.Router();

// Усі маршрути захищені аутентифікацією
router.use(auth);

/**
 * GET /api/casualties
 * Отримання списку всіх карток поранених з фільтрацією.
 *
 * Query параметри:
 *   - status: фільтр за статусом (active, closed, archived)
 *   - triageCategory: фільтр за категорією сортування (red, yellow, green, black)
 *   - search: пошук за прізвищем, позивним або номером жетона
 *   - page: сторінка (за замовчуванням 1)
 *   - limit: кількість на сторінці (за замовчуванням 20)
 *   - sort: поле для сортування (за замовчуванням -createdAt)
 */
router.get('/', async (req, res) => {
  try {
    const {
      status,
      triageCategory,
      search,
      page = 1,
      limit = 20,
      sort = '-createdAt'
    } = req.query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (triageCategory) {
      filter.triageCategory = triageCategory;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { 'patientData.lastName': searchRegex },
        { 'patientData.firstName': searchRegex },
        { 'patientData.callSign': searchRegex },
        { 'patientData.tokenNumber': searchRegex }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [casualties, total] = await Promise.all([
      CasualtyCard.find(filter)
        .populate('assignedHospital', 'name location distance')
        .populate('createdBy', 'name role')
        .populate('lastUpdatedBy', 'name role')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      CasualtyCard.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        casualties,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Помилка отримання списку поранених:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка сервера при отриманні списку поранених'
    });
  }
});

/**
 * GET /api/casualties/stats
 * Агреговані статистичні дані.
 */
router.get('/stats', async (req, res) => {
  try {
    const [
      totalCount,
      byTriage,
      byStatus,
      byDate
    ] = await Promise.all([
      CasualtyCard.countDocuments(),

      CasualtyCard.aggregate([
        { $group: { _id: '$triageCategory', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),

      CasualtyCard.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),

      CasualtyCard.aggregate([
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: -1 } },
        { $limit: 30 }
      ])
    ]);

    // Трансформуємо дані
    const triageStats = {};
    for (const item of byTriage) {
      triageStats[item._id || 'не_визначено'] = item.count;
    }

    const statusStats = {};
    for (const item of byStatus) {
      statusStats[item._id || 'не_визначено'] = item.count;
    }

    res.json({
      success: true,
      data: {
        total: totalCount,
        byTriage: triageStats,
        byStatus: statusStats,
        byDate
      }
    });
  } catch (error) {
    console.error('Помилка отримання статистики:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка сервера при отриманні статистики'
    });
  }
});

/**
 * GET /api/casualties/:id
 * Отримання окремої картки пораненого.
 */
router.get('/:id', async (req, res) => {
  try {
    const casualty = await CasualtyCard.findById(req.params.id)
      .populate('assignedHospital')
      .populate('createdBy', 'name email role')
      .populate('lastUpdatedBy', 'name email role')
      .populate('changeHistory.user', 'name role');

    if (!casualty) {
      return res.status(404).json({
        success: false,
        message: 'Картку пораненого не знайдено'
      });
    }

    res.json({
      success: true,
      data: { casualty }
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        message: 'Невірний формат ID'
      });
    }
    console.error('Помилка отримання картки:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка сервера'
    });
  }
});

/**
 * POST /api/casualties
 * Створення нової картки пораненого з автоматичним сортуванням AHP.
 */
router.post('/', async (req, res) => {
  try {
    const casualtyData = req.body;

    // Виконуємо AHP-сортування
    const triageResult = runTriageForPatient(casualtyData);

    // Створюємо картку
    const casualty = new CasualtyCard({
      ...casualtyData,
      triageCategory: triageResult.triageCategory,
      triageScore: triageResult.triageScore,
      ahpDetails: triageResult.ahpDetails,
      createdBy: req.user._id,
      lastUpdatedBy: req.user._id,
      changeHistory: [
        {
          user: req.user._id,
          action: 'Створено',
          details: `Картку створено. Категорія сортування: ${triageResult.triageCategory.toUpperCase()} (бал: ${triageResult.triageScore}). ${triageResult.triageDescription}`,
          date: new Date()
        }
      ]
    });

    await casualty.save();

    // Повертаємо з populated полями
    const populated = await CasualtyCard.findById(casualty._id)
      .populate('createdBy', 'name role')
      .populate('lastUpdatedBy', 'name role');

    res.status(201).json({
      success: true,
      message: 'Картку пораненого створено',
      data: {
        casualty: populated,
        triage: {
          category: triageResult.triageCategory,
          score: triageResult.triageScore,
          description: triageResult.triageDescription
        }
      }
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join('. ')
      });
    }
    console.error('Помилка створення картки:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка сервера при створенні картки'
    });
  }
});

/**
 * PUT /api/casualties/:id
 * Оновлення картки пораненого з перерахунком AHP.
 */
router.put('/:id', async (req, res) => {
  try {
    const casualty = await CasualtyCard.findById(req.params.id);

    if (!casualty) {
      return res.status(404).json({
        success: false,
        message: 'Картку пораненого не знайдено'
      });
    }

    const updateData = req.body;

    // Оновлюємо поля
    if (updateData.patientData) casualty.patientData = { ...casualty.patientData.toObject?.() || casualty.patientData, ...updateData.patientData };
    if (updateData.vitalSigns) casualty.vitalSigns = { ...casualty.vitalSigns?.toObject?.() || casualty.vitalSigns || {}, ...updateData.vitalSigns };
    if (updateData.injuries) casualty.injuries = updateData.injuries;
    if (updateData.priorAid) casualty.priorAid = { ...casualty.priorAid?.toObject?.() || casualty.priorAid || {}, ...updateData.priorAid };

    // Перерахунок AHP
    const triageResult = runTriageForPatient({
      vitalSigns: casualty.vitalSigns,
      injuries: casualty.injuries,
      priorAid: casualty.priorAid
    });

    const previousCategory = casualty.triageCategory;
    casualty.triageCategory = triageResult.triageCategory;
    casualty.triageScore = triageResult.triageScore;
    casualty.ahpDetails = triageResult.ahpDetails;
    casualty.lastUpdatedBy = req.user._id;

    // Запис у історію змін
    let changeDetails = 'Картку оновлено.';
    if (previousCategory !== triageResult.triageCategory) {
      changeDetails += ` Категорія змінена: ${(previousCategory || 'н/в').toUpperCase()} → ${triageResult.triageCategory.toUpperCase()}.`;
    }
    changeDetails += ` Бал: ${triageResult.triageScore}.`;

    casualty.changeHistory.push({
      user: req.user._id,
      action: 'Оновлено',
      details: changeDetails,
      date: new Date()
    });

    await casualty.save();

    const populated = await CasualtyCard.findById(casualty._id)
      .populate('assignedHospital')
      .populate('createdBy', 'name role')
      .populate('lastUpdatedBy', 'name role');

    res.json({
      success: true,
      message: 'Картку оновлено',
      data: {
        casualty: populated,
        triage: {
          category: triageResult.triageCategory,
          score: triageResult.triageScore,
          description: triageResult.triageDescription,
          previousCategory
        }
      }
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ success: false, message: 'Невірний формат ID' });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join('. ') });
    }
    console.error('Помилка оновлення картки:', error);
    res.status(500).json({ success: false, message: 'Помилка сервера при оновленні' });
  }
});

/**
 * PUT /api/casualties/:id/status
 * Оновлення лише статусу картки.
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !['active', 'closed', 'archived'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Невірний статус. Допустимі: active, closed, archived'
      });
    }

    const casualty = await CasualtyCard.findById(req.params.id);

    if (!casualty) {
      return res.status(404).json({
        success: false,
        message: 'Картку пораненого не знайдено'
      });
    }

    const previousStatus = casualty.status;
    casualty.status = status;
    casualty.lastUpdatedBy = req.user._id;

    casualty.changeHistory.push({
      user: req.user._id,
      action: 'Зміна статусу',
      details: `Статус змінено: ${previousStatus} → ${status}`,
      date: new Date()
    });

    await casualty.save();

    res.json({
      success: true,
      message: `Статус змінено на "${status}"`,
      data: { casualty }
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ success: false, message: 'Невірний формат ID' });
    }
    console.error('Помилка зміни статусу:', error);
    res.status(500).json({ success: false, message: 'Помилка сервера' });
  }
});

/**
 * PUT /api/casualties/:id/assign-hospital
 * Призначення госпіталю для пораненого.
 */
router.put('/:id/assign-hospital', async (req, res) => {
  try {
    const { hospitalId } = req.body;

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: 'ID госпіталю є обов\'язковим'
      });
    }

    const casualty = await CasualtyCard.findById(req.params.id);

    if (!casualty) {
      return res.status(404).json({
        success: false,
        message: 'Картку пораненого не знайдено'
      });
    }

    casualty.assignedHospital = hospitalId;
    casualty.lastUpdatedBy = req.user._id;

    casualty.changeHistory.push({
      user: req.user._id,
      action: 'Призначено госпіталь',
      details: `Пораненого направлено до госпіталю (ID: ${hospitalId})`,
      date: new Date()
    });

    await casualty.save();

    const populated = await CasualtyCard.findById(casualty._id)
      .populate('assignedHospital')
      .populate('createdBy', 'name role')
      .populate('lastUpdatedBy', 'name role');

    res.json({
      success: true,
      message: 'Госпіталь призначено',
      data: { casualty: populated }
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ success: false, message: 'Невірний формат ID' });
    }
    console.error('Помилка призначення госпіталю:', error);
    res.status(500).json({ success: false, message: 'Помилка сервера' });
  }
});

/**
 * DELETE /api/casualties/:id
 * Видалення картки (тільки для адміністратора).
 */
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const casualty = await CasualtyCard.findById(req.params.id);

    if (!casualty) {
      return res.status(404).json({
        success: false,
        message: 'Картку пораненого не знайдено'
      });
    }

    await CasualtyCard.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Картку видалено'
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ success: false, message: 'Невірний формат ID' });
    }
    console.error('Помилка видалення картки:', error);
    res.status(500).json({ success: false, message: 'Помилка сервера' });
  }
});

module.exports = router;
