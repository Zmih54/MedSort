/**
 * Сервіс маршрутизації поранених до госпіталів.
 *
 * Рекомендує оптимальний госпіталь на основі:
 *   1. Відповідність спеціалізації (тип травми → необхідна спеціалізація)
 *   2. Доступна місткість (більше = краще)
 *   3. Відстань (менше = краще)
 */

/**
 * Маппінг типу травми до необхідної спеціалізації госпіталю.
 */
const INJURY_SPECIALIZATION_MAP = {
  // --- Бойові травми ---
  'вогнепальне': ['хірургія', 'реанімація'],
  'осколкове': ['хірургія', 'реанімація'],
  'мінно-вибухове': ['хірургія', 'травматологія', 'реанімація'],
  'контузія': ['нейрохірургія'],
  'ампутація': ['хірургія', 'судинна', 'реанімація'],
  'кровотеча': ['хірургія', 'реанімація'],

  // --- Загальні хірургічні ---
  'черепно-мозкова': ['нейрохірургія', 'реанімація'],
  'чмт': ['нейрохірургія', 'реанімація'],
  'торакальна': ['торакальна', 'хірургія', 'реанімація'],
  'абдомінальна': ['хірургія', 'реанімація'],
  'кінцівка': ['травматологія', 'хірургія'],
  'судинна': ['судинна', 'хірургія'],
  'хребет': ['нейрохірургія', 'травматологія'],
  'множинна': ['хірургія', 'реанімація', 'травматологія'],

  // --- Опорно-рухова система ---
  'перелом': ['травматологія', 'ортопедія'],
  'вивих': ['травматологія', 'ортопедія'],
  'розтягнення': ['травматологія', 'ортопедія'],
  'спортивна': ['травматологія', 'ортопедія'],

  // --- Термічні та хімічні ---
  'опік': ['опікова', 'хірургія'],
  'термічна': ['опікова'],
  'хімічне': ['реанімація', 'хірургія'],

  // --- Цивільні травми ---
  'дтп': ['хірургія', 'травматологія', 'реанімація'],
  'падіння': ['травматологія', 'хірургія'],
  'виробнича': ['хірургія', 'травматологія'],
  'електротравма': ['реанімація', 'хірургія'],
  'електро': ['реанімація', 'хірургія'],
  'отруєння': ['реанімація'],
  'інтоксикація': ['реанімація'],
  'утоплення': ['реанімація'],
  'укус': ['хірургія'],
  'порізи': ['хірургія'],
  'рана': ['хірургія'],
  'лацерація': ['хірургія'],
};

/**
 * Визначає необхідні спеціалізації на основі травм пацієнта.
 * @param {object[]} injuries - Масив травм пацієнта
 * @returns {string[]} Масив необхідних спеціалізацій
 */
function getRequiredSpecializations(injuries) {
  if (!injuries || injuries.length === 0) {
    return ['хірургія']; // За замовчуванням — хірургія
  }

  const specializations = new Set();

  for (const injury of injuries) {
    const type = (injury.type || '').toLowerCase();
    const location = (injury.location || '').toLowerCase();

    // Пошук за типом травми
    for (const [key, specs] of Object.entries(INJURY_SPECIALIZATION_MAP)) {
      if (type.includes(key.toLowerCase()) || location.includes(key.toLowerCase())) {
        specs.forEach((s) => specializations.add(s));
      }
    }

    // Додаємо реанімацію для критичних та тяжких травм
    if (injury.severity === 'critical') {
      specializations.add('реанімація');
    }
    if (injury.severity === 'severe') {
      specializations.add('хірургія');
    }
  }

  // Якщо нічого не знайдено — загальна хірургія
  if (specializations.size === 0) {
    specializations.add('хірургія');
  }

  return Array.from(specializations);
}

/**
 * Обчислює відсоток відповідності спеціалізацій госпіталю до потреб пацієнта.
 * @param {string[]} hospitalSpecs - Спеціалізації госпіталю
 * @param {string[]} requiredSpecs - Необхідні спеціалізації
 * @returns {number} Відсоток відповідності (0-100)
 */
function calculateSpecializationMatch(hospitalSpecs, requiredSpecs) {
  if (requiredSpecs.length === 0) return 100;
  if (!hospitalSpecs || hospitalSpecs.length === 0) return 0;

  let matchCount = 0;
  for (const spec of requiredSpecs) {
    if (hospitalSpecs.includes(spec)) {
      matchCount++;
    }
  }

  return Math.round((matchCount / requiredSpecs.length) * 100);
}

/**
 * Нормалізує значення в діапазон [0, 1].
 * @param {number} value - Поточне значення
 * @param {number} min - Мінімум
 * @param {number} max - Максимум
 * @param {boolean} inverse - Якщо true, менше значення = кращий бал
 * @returns {number} Нормалізований бал
 */
function normalizeScore(value, min, max, inverse = false) {
  if (max === min) return 1;
  const normalized = (value - min) / (max - min);
  return inverse ? 1 - normalized : normalized;
}

/**
 * Рекомендує госпіталі для конкретного пораненого.
 *
 * Ваги критеріїв маршрутизації:
 *   - Відповідність спеціалізації: 50%
 *   - Доступна місткість: 25%
 *   - Відстань (менше = краще): 25%
 *
 * @param {object} casualty - Картка пораненого (з полями injuries, triageCategory)
 * @param {object[]} hospitals - Масив госпіталів
 * @returns {object[]} Відсортований масив рекомендацій
 */
function recommendHospitals(casualty, hospitals) {
  if (!hospitals || hospitals.length === 0) {
    return [];
  }

  // Фільтруємо лише активні госпіталі
  const activeHospitals = hospitals.filter((h) => h.isActive !== false);

  if (activeHospitals.length === 0) {
    return [];
  }

  // Визначаємо необхідні спеціалізації
  const requiredSpecs = getRequiredSpecializations(casualty.injuries);

  // Ваги критеріїв маршрутизації
  const WEIGHT_SPECIALIZATION = 0.50;
  const WEIGHT_CAPACITY = 0.25;
  const WEIGHT_DISTANCE = 0.25;

  // Для RED категорії збільшуємо вагу відстані (час критичний)
  let wSpec = WEIGHT_SPECIALIZATION;
  let wCap = WEIGHT_CAPACITY;
  let wDist = WEIGHT_DISTANCE;

  if (casualty.triageCategory === 'red') {
    wSpec = 0.40;
    wCap = 0.20;
    wDist = 0.40; // Відстань критична для RED
  }

  // Збираємо дані для нормалізації
  const capacities = activeHospitals.map((h) => {
    const available = (h.totalCapacity || 0) - (h.currentLoad || 0);
    return Math.max(0, available);
  });
  const distances = activeHospitals.map((h) => h.distance || 0);

  const minCap = Math.min(...capacities);
  const maxCap = Math.max(...capacities);
  const minDist = Math.min(...distances);
  const maxDist = Math.max(...distances);

  // Обчислюємо бал для кожного госпіталю
  const recommendations = activeHospitals.map((hospital, idx) => {
    const specMatch = calculateSpecializationMatch(hospital.specializations, requiredSpecs);
    const specScore = specMatch / 100;

    const availableCapacity = capacities[idx];
    const capScore = normalizeScore(availableCapacity, minCap, maxCap, false);

    const distScore = normalizeScore(distances[idx], minDist, maxDist, true); // менше = краще

    const totalScore = (specScore * wSpec) + (capScore * wCap) + (distScore * wDist);

    // Штраф якщо госпіталь повністю завантажений
    const penaltyMultiplier = availableCapacity <= 0 ? 0.1 : 1;

    return {
      hospital: {
        _id: hospital._id,
        name: hospital.name,
        location: hospital.location,
        specializations: hospital.specializations,
        distance: hospital.distance,
        totalCapacity: hospital.totalCapacity,
        currentLoad: hospital.currentLoad,
        availableCapacity,
        loadPercentage: hospital.totalCapacity > 0
          ? Math.round((hospital.currentLoad / hospital.totalCapacity) * 100)
          : 100,
        contactPhone: hospital.contactPhone
      },
      scoring: {
        specializationMatch: specMatch,
        specializationScore: Math.round(specScore * 10000) / 10000,
        capacityScore: Math.round(capScore * 10000) / 10000,
        distanceScore: Math.round(distScore * 10000) / 10000,
        totalScore: Math.round(totalScore * penaltyMultiplier * 10000) / 10000
      },
      requiredSpecializations: requiredSpecs,
      isRecommended: specMatch >= 50 && availableCapacity > 0
    };
  });

  // Сортуємо за загальним балом (від найвищого)
  recommendations.sort((a, b) => b.scoring.totalScore - a.scoring.totalScore);

  // Додаємо ранг
  recommendations.forEach((r, i) => {
    r.rank = i + 1;
  });

  return recommendations;
}

module.exports = {
  recommendHospitals,
  getRequiredSpecializations,
  calculateSpecializationMatch,
  INJURY_SPECIALIZATION_MAP
};
