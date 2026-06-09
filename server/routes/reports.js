const express = require('express');
const CasualtyCard = require('../models/CasualtyCard');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Усі маршрути захищені аутентифікацією
router.use(auth);

/**
 * GET /api/reports/summary
 * Загальна зведена статистика.
 *
 * Query параметри:
 *   - startDate: початок періоду (ISO формат)
 *   - endDate: кінець періоду (ISO формат)
 */
router.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};

    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    const matchStage = {};
    if (Object.keys(dateFilter).length > 0) {
      matchStage.createdAt = dateFilter;
    }

    const [
      totalCasualties,
      byTriage,
      byInjuryType,
      byStatus,
      avgTriageScore,
      recentCasualties
    ] = await Promise.all([
      // Загальна кількість
      CasualtyCard.countDocuments(matchStage),

      // За категорією сортування
      CasualtyCard.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$triageCategory',
            count: { $sum: 1 },
            avgScore: { $avg: '$triageScore' }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // За типом поранення
      CasualtyCard.aggregate([
        { $match: matchStage },
        { $unwind: { path: '$injuries', preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: '$injuries.type',
            count: { $sum: 1 },
            severities: {
              $push: '$injuries.severity'
            }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ]),

      // За статусом
      CasualtyCard.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),

      // Середній бал сортування
      CasualtyCard.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            avgScore: { $avg: '$triageScore' },
            maxScore: { $max: '$triageScore' },
            minScore: { $min: '$triageScore' }
          }
        }
      ]),

      // Останні 5 поранених
      CasualtyCard.find(matchStage)
        .select('patientData.lastName patientData.firstName patientData.callSign triageCategory triageScore status createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
    ]);

    // Підрахунок тяжкості серед типів поранень
    const injuryTypeStats = byInjuryType.map((item) => {
      const severityCounts = {};
      for (const sev of item.severities) {
        severityCounts[sev] = (severityCounts[sev] || 0) + 1;
      }
      return {
        type: item._id || 'Не визначено',
        count: item.count,
        severityBreakdown: severityCounts
      };
    });

    // Формуємо результат
    const triageMap = {};
    for (const item of byTriage) {
      triageMap[item._id || 'не_визначено'] = {
        count: item.count,
        avgScore: Math.round(item.avgScore * 100) / 100
      };
    }

    const statusMap = {};
    for (const item of byStatus) {
      statusMap[item._id || 'не_визначено'] = item.count;
    }

    const scoreStats = avgTriageScore.length > 0 ? avgTriageScore[0] : { avgScore: 0, maxScore: 0, minScore: 0 };

    res.json({
      success: true,
      data: {
        totalCasualties,
        byTriage: triageMap,
        byInjuryType: injuryTypeStats,
        byStatus: statusMap,
        scoreStats: {
          average: Math.round((scoreStats.avgScore || 0) * 100) / 100,
          max: Math.round((scoreStats.maxScore || 0) * 100) / 100,
          min: Math.round((scoreStats.minScore || 0) * 100) / 100
        },
        recentCasualties,
        period: {
          startDate: startDate || 'Не вказано',
          endDate: endDate || 'Не вказано'
        }
      }
    });
  } catch (error) {
    console.error('Помилка генерації зведеної статистики:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка сервера при генерації звіту'
    });
  }
});

/**
 * GET /api/reports/by-date
 * Поранені, згруповані за датою.
 *
 * Query: startDate, endDate, granularity (day|week|month)
 */
router.get('/by-date', async (req, res) => {
  try {
    const { startDate, endDate, granularity = 'day' } = req.query;

    const matchStage = {};
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    let dateFormat;
    switch (granularity) {
      case 'week':
        dateFormat = '%Y-W%V';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
      default:
        dateFormat = '%Y-%m-%d';
    }

    const results = await CasualtyCard.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: dateFormat, date: '$createdAt' } },
            triageCategory: '$triageCategory'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          total: { $sum: '$count' },
          categories: {
            $push: {
              category: '$_id.triageCategory',
              count: '$count'
            }
          }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 90 }
    ]);

    // Трансформуємо для зручності
    const formattedResults = results.map((item) => {
      const categoryMap = {};
      for (const cat of item.categories) {
        categoryMap[cat.category || 'не_визначено'] = cat.count;
      }
      return {
        date: item._id,
        total: item.total,
        red: categoryMap.red || 0,
        yellow: categoryMap.yellow || 0,
        green: categoryMap.green || 0,
        black: categoryMap.black || 0
      };
    });

    res.json({
      success: true,
      data: {
        granularity,
        results: formattedResults
      }
    });
  } catch (error) {
    console.error('Помилка звіту за датами:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка сервера при генерації звіту за датами'
    });
  }
});

/**
 * GET /api/reports/by-triage
 * Деталізований розподіл за категорією сортування.
 */
router.get('/by-triage', async (req, res) => {
  try {
    const results = await CasualtyCard.aggregate([
      {
        $group: {
          _id: '$triageCategory',
          count: { $sum: 1 },
          avgScore: { $avg: '$triageScore' },
          minScore: { $min: '$triageScore' },
          maxScore: { $max: '$triageScore' },
          patients: {
            $push: {
              _id: '$_id',
              lastName: '$patientData.lastName',
              firstName: '$patientData.firstName',
              callSign: '$patientData.callSign',
              score: '$triageScore',
              status: '$status'
            }
          }
        }
      },
      { $sort: { avgScore: -1 } }
    ]);

    // Назви категорій українською
    const categoryNames = {
      red: 'Негайна (Т1)',
      yellow: 'Відкладена (Т2)',
      green: 'Мала (Т3)',
      black: 'Безнадійна (Т4)'
    };

    const formattedResults = results.map((item) => ({
      category: item._id || 'Не визначено',
      categoryName: categoryNames[item._id] || 'Не визначено',
      count: item.count,
      avgScore: Math.round(item.avgScore * 100) / 100,
      minScore: Math.round(item.minScore * 100) / 100,
      maxScore: Math.round(item.maxScore * 100) / 100,
      patients: item.patients.map((p) => ({
        _id: p._id,
        name: `${p.lastName || ''} ${p.firstName || ''}`.trim(),
        callSign: p.callSign,
        score: Math.round(p.score * 100) / 100,
        status: p.status
      }))
    }));

    res.json({
      success: true,
      data: { results: formattedResults }
    });
  } catch (error) {
    console.error('Помилка звіту за категоріями:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка сервера при генерації звіту за категоріями'
    });
  }
});

/**
 * GET /api/reports/by-injury
 * Розподіл за типом поранення.
 */
router.get('/by-injury', async (req, res) => {
  try {
    const results = await CasualtyCard.aggregate([
      { $unwind: { path: '$injuries', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: {
            type: '$injuries.type',
            severity: '$injuries.severity'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.type',
          totalCount: { $sum: '$count' },
          severities: {
            $push: {
              severity: '$_id.severity',
              count: '$count'
            }
          }
        }
      },
      { $sort: { totalCount: -1 } }
    ]);

    // Також отримуємо розподіл за локалізацією поранення
    const byLocation = await CasualtyCard.aggregate([
      { $unwind: { path: '$injuries', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: '$injuries.location',
          count: { $sum: 1 },
          types: { $addToSet: '$injuries.type' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    const formattedResults = results.map((item) => {
      const severityMap = {};
      for (const s of item.severities) {
        severityMap[s.severity || 'не_визначено'] = s.count;
      }
      return {
        injuryType: item._id || 'Не визначено',
        totalCount: item.totalCount,
        bySeverity: {
          light: severityMap.light || 0,
          moderate: severityMap.moderate || 0,
          severe: severityMap.severe || 0,
          critical: severityMap.critical || 0
        }
      };
    });

    const locationResults = byLocation.map((item) => ({
      location: item._id || 'Не визначено',
      count: item.count,
      injuryTypes: item.types
    }));

    res.json({
      success: true,
      data: {
        byType: formattedResults,
        byLocation: locationResults
      }
    });
  } catch (error) {
    console.error('Помилка звіту за типами поранень:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка сервера при генерації звіту за типами поранень'
    });
  }
});

module.exports = router;
