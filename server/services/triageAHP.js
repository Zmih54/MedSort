/**
 * Сервіс медичного сортування на основі методу аналізу ієрархій (МАІ / AHP).
 *
 * Реалізація алгоритму з Розділу 6 дипломної роботи.
 *
 * Критерії:
 *   C1 — Кровообіг (Circulation)
 *   C2 — Дихання (Breathing)
 *   C3 — Неврологія (Neurology)
 *   C4 — Прохідність дихальних шляхів (Airway)
 *   C5 — Тяжкість поранення (Injury Severity)
 */

// =====================================================
// Матриця парних порівнянь критеріїв (Таблиця 6.1)
// =====================================================
const PAIRWISE_MATRIX = [
  [1,     3,     5,     1/3,   4   ],  // C1 — Кровообіг
  [1/3,   1,     3,     1/3,   3   ],  // C2 — Дихання
  [1/5,   1/3,   1,     1/4,   2   ],  // C3 — Неврологія
  [3,     3,     4,     1,     4   ],  // C4 — Прохідність дихальних шляхів
  [1/4,   1/3,   1/2,   1/4,   1   ],  // C5 — Тяжкість поранення
];

// Випадковий індекс узгодженості для n = 5
const RI_VALUES = { 1: 0, 2: 0, 3: 0.58, 4: 0.9, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49 };

// =====================================================
// Допоміжні математичні функції
// =====================================================

/**
 * Множення матриці на вектор.
 */
function multiplyMatrixVector(matrix, vector) {
  const n = matrix.length;
  const result = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      result[i] += matrix[i][j] * vector[j];
    }
  }
  return result;
}

/**
 * Нормалізація вектора (сума = 1).
 */
function normalizeVector(vector) {
  const sum = vector.reduce((a, b) => a + b, 0);
  if (sum === 0) return vector.map(() => 1 / vector.length);
  return vector.map((v) => v / sum);
}

/**
 * Обчислення власного вектора методом степеневої ітерації.
 * Повертає нормалізований вектор ваг критеріїв.
 */
function powerIteration(matrix, maxIterations = 100, tolerance = 1e-8) {
  const n = matrix.length;
  let vector = new Array(n).fill(1);
  vector = normalizeVector(vector);

  for (let iter = 0; iter < maxIterations; iter++) {
    const newVector = multiplyMatrixVector(matrix, vector);
    const normalized = normalizeVector(newVector);

    // Перевірка збіжності
    let maxDiff = 0;
    for (let i = 0; i < n; i++) {
      maxDiff = Math.max(maxDiff, Math.abs(normalized[i] - vector[i]));
    }

    vector = normalized;

    if (maxDiff < tolerance) {
      break;
    }
  }

  return vector;
}

/**
 * Обчислення максимального власного значення λmax.
 */
function calculateLambdaMax(matrix, weights) {
  const n = matrix.length;
  const Aw = multiplyMatrixVector(matrix, weights);
  let lambdaMax = 0;
  for (let i = 0; i < n; i++) {
    if (weights[i] > 0) {
      lambdaMax += Aw[i] / weights[i];
    }
  }
  return lambdaMax / n;
}

/**
 * Перевірка узгодженості матриці.
 * CR ≤ 0.1 — матриця вважається узгодженою.
 */
function checkConsistency(matrix, weights) {
  const n = matrix.length;
  const lambdaMax = calculateLambdaMax(matrix, weights);
  const CI = (lambdaMax - n) / (n - 1);
  const RI = RI_VALUES[n] || 1.12;
  const CR = RI === 0 ? 0 : CI / RI;

  return {
    lambdaMax: Math.round(lambdaMax * 10000) / 10000,
    CI: Math.round(CI * 10000) / 10000,
    RI,
    CR: Math.round(CR * 10000) / 10000,
    isConsistent: CR <= 0.1
  };
}

// =====================================================
// Обчислення ваг критеріїв
// =====================================================

/**
 * Обчислює ваги критеріїв за матрицею парних порівнянь.
 * @returns {{ weights: number[], consistency: object, labels: string[] }}
 */
function calculateCriteriaWeights() {
  const weights = powerIteration(PAIRWISE_MATRIX);
  const consistency = checkConsistency(PAIRWISE_MATRIX, weights);

  const labels = [
    'C1_Кровообіг',
    'C2_Дихання',
    'C3_Неврологія',
    'C4_Дихальні_шляхи',
    'C5_Тяжкість_поранення'
  ];

  const weightMap = {};
  labels.forEach((label, i) => {
    weightMap[label] = Math.round(weights[i] * 10000) / 10000;
  });

  return {
    weights,
    weightMap,
    consistency,
    labels
  };
}

// =====================================================
// Оцінка пацієнта за кожним критерієм (шкала Сааті 1-9)
// =====================================================

/**
 * C1 — Кровообіг: оцінка на основі пульсу та систолічного АТ.
 * Вищий бал = гірший стан = вищий пріоритет.
 */
function scoreCirculation(vitalSigns) {
  const pulse = vitalSigns.pulse || 80;
  const systolicBP = vitalSigns.systolicBP || 120;

  let score = 1;

  // Оцінка за пульсом
  if (pulse === 0) {
    score = 9; // Зупинка серця
  } else if (pulse > 150 || pulse < 40) {
    score = 8;
  } else if (pulse > 130 || pulse < 50) {
    score = 6;
  } else if (pulse > 120 || pulse < 55) {
    score = 5;
  } else if (pulse > 110 || pulse < 60) {
    score = 4;
  } else if (pulse > 100) {
    score = 3;
  } else {
    score = 1;
  }

  // Корекція за систолічним АТ
  if (systolicBP < 60) {
    score = Math.min(9, score + 3);
  } else if (systolicBP < 80) {
    score = Math.min(9, score + 2);
  } else if (systolicBP < 90) {
    score = Math.min(9, score + 1);
  }

  return Math.max(1, Math.min(9, score));
}

/**
 * C2 — Дихання: оцінка на основі частоти дихання та SpO2.
 */
function scoreBreathing(vitalSigns) {
  const rr = vitalSigns.respiratoryRate || 16;
  const spo2 = vitalSigns.spo2 || 98;

  let score = 1;

  // Оцінка за частотою дихання
  if (rr === 0) {
    score = 9; // Апное
  } else if (rr > 40 || rr < 8) {
    score = 8;
  } else if (rr > 35 || rr < 10) {
    score = 6;
  } else if (rr > 30) {
    score = 5;
  } else if (rr > 25) {
    score = 4;
  } else if (rr > 20) {
    score = 2;
  } else {
    score = 1;
  }

  // Корекція за SpO2
  if (spo2 < 70) {
    score = Math.min(9, score + 4);
  } else if (spo2 < 80) {
    score = Math.min(9, score + 3);
  } else if (spo2 < 85) {
    score = Math.min(9, score + 2);
  } else if (spo2 < 90) {
    score = Math.min(9, score + 1);
  }

  return Math.max(1, Math.min(9, score));
}

/**
 * C3 — Неврологія: оцінка за шкалою AVPU.
 */
function scoreNeurology(vitalSigns) {
  const consciousness = vitalSigns.consciousness || 'A';

  const avpuScores = {
    A: 1, // Alert — притомний
    V: 3, // Voice — реагує на голос
    P: 5, // Pain — реагує на біль
    U: 9  // Unresponsive — без свідомості
  };

  return avpuScores[consciousness] || 1;
}

/**
 * C4 — Прохідність дихальних шляхів: оцінка на основі стану та наданої допомоги.
 */
function scoreAirway(vitalSigns, priorAid) {
  let score = 1;
  const rr = vitalSigns.respiratoryRate || 16;
  const consciousness = vitalSigns.consciousness || 'A';
  const airway = (priorAid && priorAid.airwayManagement) || '';

  // Без свідомості — високий ризик обструкції
  if (consciousness === 'U') {
    score = Math.min(9, score + 4);
  } else if (consciousness === 'P') {
    score = Math.min(9, score + 2);
  }

  // Якщо проводилось управління дихальними шляхами — стан був критичним
  if (airway) {
    const airwayLower = airway.toLowerCase();
    if (airwayLower.includes('інтубація') || airwayLower.includes('intubat') || airwayLower.includes('крікотиреотомія')) {
      score = Math.min(9, score + 4);
    } else if (airwayLower.includes('орофарингеальний') || airwayLower.includes('назофарингеальний') || airwayLower.includes('opa') || airwayLower.includes('npa')) {
      score = Math.min(9, score + 2);
    } else if (airwayLower.includes('позиція') || airwayLower.includes('очищення')) {
      score = Math.min(9, score + 1);
    }
  }

  // Якщо дихання відсутнє або дуже низьке
  if (rr === 0) {
    score = 9;
  } else if (rr < 8) {
    score = Math.min(9, score + 2);
  }

  return Math.max(1, Math.min(9, score));
}

/**
 * C5 — Тяжкість поранення: оцінка на основі масиву травм.
 */
function scoreInjurySeverity(injuries) {
  if (!injuries || injuries.length === 0) {
    return 1;
  }

  const severityScores = {
    light: 1,
    moderate: 3,
    severe: 6,
    critical: 9
  };

  // Беремо максимальну тяжкість серед усіх травм
  let maxSeverity = 1;
  let totalInjuries = injuries.length;

  for (const injury of injuries) {
    const sev = severityScores[injury.severity] || 1;
    maxSeverity = Math.max(maxSeverity, sev);
  }

  // Додаємо бал за множинні поранення
  let multipleBonus = 0;
  if (totalInjuries >= 4) {
    multipleBonus = 3;
  } else if (totalInjuries >= 3) {
    multipleBonus = 2;
  } else if (totalInjuries >= 2) {
    multipleBonus = 1;
  }

  return Math.max(1, Math.min(9, maxSeverity + multipleBonus));
}

// =====================================================
// Обчислення балів пацієнта за всіма критеріями
// =====================================================

/**
 * Обчислює бали пацієнта за кожним з 5 критеріїв.
 * @param {object} vitalSigns - Вітальні показники пацієнта
 * @param {object[]} injuries - Масив травм
 * @param {object} priorAid - Надана домедична допомога
 * @returns {{ scores: number[], scoreMap: object }}
 */
function calculatePatientScore(vitalSigns, injuries, priorAid) {
  const vs = vitalSigns || {};
  const inj = injuries || [];
  const aid = priorAid || {};

  const c1 = scoreCirculation(vs);
  const c2 = scoreBreathing(vs);
  const c3 = scoreNeurology(vs);
  const c4 = scoreAirway(vs, aid);
  const c5 = scoreInjurySeverity(inj);

  const scores = [c1, c2, c3, c4, c5];
  const scoreMap = {
    C1_Кровообіг: c1,
    C2_Дихання: c2,
    C3_Неврологія: c3,
    C4_Дихальні_шляхи: c4,
    C5_Тяжкість_поранення: c5
  };

  return { scores, scoreMap };
}

// =====================================================
// Обчислення глобального пріоритету
// =====================================================

/**
 * Обчислює глобальний пріоритет пацієнта.
 * P(i) = Σ( score(i,j) * weight(j) )
 *
 * @param {number[]} patientScores - Бали пацієнта за кожним критерієм
 * @param {number[]} weights - Ваги критеріїв
 * @returns {number} Глобальний пріоритет
 */
function calculateGlobalPriority(patientScores, weights) {
  let priority = 0;
  for (let j = 0; j < weights.length; j++) {
    priority += patientScores[j] * weights[j];
  }
  return Math.round(priority * 10000) / 10000;
}

// =====================================================
// Визначення категорії сортування
// =====================================================

/**
 * Визначає категорію медичного сортування за глобальним пріоритетом.
 *
 * Пороги визначаються відносно розподілу пріоритетів:
 *   RED (Негайна)     — найвищий пріоритет (≥ 6.0)
 *   YELLOW (Відкладена) — помірний пріоритет (≥ 3.5)
 *   GREEN (Мала)       — низький пріоритет (≥ 1.5)
 *   BLACK (Безнадійна)  — коли стан безнадійний (окремі критерії)
 *
 * @param {number} globalPriority - Глобальний пріоритет пацієнта
 * @param {number[]} patientScores - Бали пацієнта
 * @returns {{ category: string, score: number, description: string }}
 */
function calculateTriageCategory(globalPriority, patientScores) {
  // Перевірка на BLACK: зупинка серця + відсутність дихання + без свідомості
  const c1 = patientScores[0]; // Кровообіг
  const c2 = patientScores[1]; // Дихання
  const c3 = patientScores[2]; // Неврологія

  if (c1 === 9 && c2 === 9 && c3 === 9) {
    return {
      category: 'black',
      score: globalPriority,
      description: 'Безнадійна (Т4) — ознаки біологічної смерті або травми, несумісні з життям'
    };
  }

  if (globalPriority >= 6.0) {
    return {
      category: 'red',
      score: globalPriority,
      description: 'Негайна (Т1) — потребує негайної медичної допомоги'
    };
  }

  if (globalPriority >= 3.5) {
    return {
      category: 'yellow',
      score: globalPriority,
      description: 'Відкладена (Т2) — серйозний стан, допомога може бути відкладена на короткий час'
    };
  }

  if (globalPriority >= 1.5) {
    return {
      category: 'green',
      score: globalPriority,
      description: 'Мала (Т3) — легкі поранення, може чекати на допомогу'
    };
  }

  return {
    category: 'green',
    score: globalPriority,
    description: 'Мала (Т3) — мінімальні ушкодження'
  };
}

// =====================================================
// Головна функція сортування для одного пацієнта
// =====================================================

/**
 * Повний цикл медичного сортування для одного пацієнта.
 *
 * @param {object} casualtyData - Дані картки пораненого
 * @returns {{ triageCategory: string, triageScore: number, ahpDetails: object }}
 */
function runTriageForPatient(casualtyData) {
  // 1. Обчислити ваги критеріїв
  const { weights, weightMap, consistency } = calculateCriteriaWeights();

  // 2. Обчислити бали пацієнта
  const { scores, scoreMap } = calculatePatientScore(
    casualtyData.vitalSigns,
    casualtyData.injuries,
    casualtyData.priorAid
  );

  // 3. Обчислити глобальний пріоритет
  const globalPriority = calculateGlobalPriority(scores, weights);

  // 4. Визначити категорію сортування
  const triage = calculateTriageCategory(globalPriority, scores);

  return {
    triageCategory: triage.category,
    triageScore: globalPriority,
    triageDescription: triage.description,
    ahpDetails: {
      criteriaWeights: weightMap,
      patientScores: scoreMap,
      globalPriority,
      consistency
    }
  };
}

// =====================================================
// Сортування групи пацієнтів
// =====================================================

/**
 * Виконує сортування для групи пацієнтів та ранжує їх.
 *
 * @param {object[]} casualties - Масив карток поранених
 * @returns {object[]} Масив результатів, відсортований за пріоритетом (від найвищого)
 */
function runTriageForAll(casualties) {
  if (!casualties || casualties.length === 0) {
    return [];
  }

  const { weights, weightMap, consistency } = calculateCriteriaWeights();

  const results = casualties.map((casualty, index) => {
    const { scores, scoreMap } = calculatePatientScore(
      casualty.vitalSigns,
      casualty.injuries,
      casualty.priorAid
    );

    const globalPriority = calculateGlobalPriority(scores, weights);
    const triage = calculateTriageCategory(globalPriority, scores);

    return {
      casualtyId: casualty._id || `patient_${index + 1}`,
      patientName: casualty.patientData
        ? `${casualty.patientData.lastName || ''} ${casualty.patientData.firstName || ''}`.trim()
        : `Пацієнт ${index + 1}`,
      triageCategory: triage.category,
      triageScore: globalPriority,
      triageDescription: triage.description,
      ahpDetails: {
        criteriaWeights: weightMap,
        patientScores: scoreMap,
        globalPriority,
        consistency
      }
    };
  });

  // Сортуємо за глобальним пріоритетом (найвищий = найбільш терміновий)
  results.sort((a, b) => b.triageScore - a.triageScore);

  // Додаємо ранг
  results.forEach((r, i) => {
    r.rank = i + 1;
  });

  return results;
}

module.exports = {
  calculateCriteriaWeights,
  calculatePatientScore,
  calculateTriageCategory,
  runTriageForPatient,
  runTriageForAll,
  // Допоміжні (для тестування)
  scoreCirculation,
  scoreBreathing,
  scoreNeurology,
  scoreAirway,
  scoreInjurySeverity,
  PAIRWISE_MATRIX,
  checkConsistency,
  powerIteration
};
