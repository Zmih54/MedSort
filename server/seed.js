/**
 * Скрипт наповнення бази даних тестовими даними.
 *
 * Створює:
 *   - 3 користувачі (admin, doctor, combat_medic)
 *   - 5 госпіталів з різними спеціалізаціями
 *   - 10 карток поранених (B1–B10) з різними вітальними ознаками та травмами
 *
 * Очікуваний порядок ранжування AHP (від найвищого пріоритету):
 *   B1 – B2 – B6 – B3 – B9 – B4 – B7 – B8 – B5 – B10
 *
 * Запуск: npm run seed
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Hospital = require('./models/Hospital');
const CasualtyCard = require('./models/CasualtyCard');
const { runTriageForPatient, runTriageForAll } = require('./services/triageAHP');

async function seed() {
  try {
    // Підключення до MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Підключено до MongoDB');

    // ============================
    // Очищення існуючих даних
    // ============================
    await Promise.all([
      User.deleteMany({}),
      Hospital.deleteMany({}),
      CasualtyCard.deleteMany({})
    ]);
    console.log('🗑️  Базу даних очищено');

    // ============================
    // Створення користувачів
    // ============================
    const users = await User.create([
      {
        name: 'Адміністратор Системи',
        email: 'admin@medsort.ua',
        password: 'admin123',
        role: 'admin',
        rank: 'полковник'
      },
      {
        name: 'Лікар Петренко Олександр',
        email: 'doctor@medsort.ua',
        password: 'doctor123',
        role: 'doctor',
        rank: 'майор'
      },
      {
        name: 'Медик Шевченко Ірина',
        email: 'medic@medsort.ua',
        password: 'medic123',
        role: 'combat_medic',
        rank: 'старший солдат'
      }
    ]);

    console.log('👥 Створено 3 користувачі:');
    for (const u of users) {
      console.log(`   - ${u.name} (${u.email}) — ${u.role}`);
    }

    const adminUser = users[0];
    const doctorUser = users[1];
    const medicUser = users[2];

    // ============================
    // Створення госпіталів
    // ============================
    const hospitals = await Hospital.create([
      {
        name: 'Головний військовий госпіталь',
        location: 'м. Київ, вул. Госпітальна, 18',
        coordinates: { lat: 50.4501, lng: 30.5234 },
        specializations: ['хірургія', 'нейрохірургія', 'реанімація', 'травматологія', 'торакальна'],
        totalCapacity: 100,
        currentLoad: 65,
        distance: 30,
        contactPhone: '+380441234567',
        isActive: true
      },
      {
        name: 'Стабілізаційний пункт №1',
        location: 'Зона ООС, сектор Б',
        coordinates: { lat: 48.5, lng: 37.5 },
        specializations: ['хірургія', 'реанімація'],
        totalCapacity: 20,
        currentLoad: 12,
        distance: 5,
        contactPhone: '+380501112233',
        isActive: true
      },
      {
        name: 'Обласна клінічна лікарня',
        location: 'м. Дніпро, просп. Героїв, 42',
        coordinates: { lat: 48.4647, lng: 35.0462 },
        specializations: ['нейрохірургія', 'травматологія'],
        totalCapacity: 80,
        currentLoad: 45,
        distance: 45,
        contactPhone: '+380562987654',
        isActive: true
      },
      {
        name: 'Військовий шпиталь №2',
        location: 'м. Запоріжжя, вул. Перемоги, 7',
        coordinates: { lat: 47.8388, lng: 35.1396 },
        specializations: ['хірургія', 'торакальна'],
        totalCapacity: 50,
        currentLoad: 30,
        distance: 20,
        contactPhone: '+380612445566',
        isActive: true
      },
      {
        name: 'Медичний центр ЗСУ',
        location: 'м. Харків, вул. Медична, 1',
        coordinates: { lat: 49.9935, lng: 36.2304 },
        specializations: ['хірургія', 'нейрохірургія', 'реанімація', 'травматологія', 'торакальна'],
        totalCapacity: 120,
        currentLoad: 70,
        distance: 60,
        contactPhone: '+380577778899',
        isActive: true
      }
    ]);

    console.log('\n🏥 Створено 5 госпіталів:');
    for (const h of hospitals) {
      console.log(`   - ${h.name} (${h.totalCapacity} ліжок, ${h.distance} км, завантаж. ${h.currentLoad}/${h.totalCapacity})`);
    }

    // ============================
    // Дані для 10 карток поранених (B1–B10)
    // ============================
    const casualtyDataArray = [
      // B1 — Найтяжчий: масивна кровотеча, тахікардія, гіпотензія, без свідомості
      {
        patientData: {
          lastName: 'Бондаренко',
          firstName: 'Андрій',
          middleName: 'Петрович',
          callSign: 'Беркут',
          tokenNumber: 'UA-2025-0001',
          rank: 'старший сержант',
          unit: '3-тя ОШБр',
          age: 28,
          gender: 'male',
          injuryDate: new Date('2025-06-01'),
          injuryTime: '14:30',
          injuryLocation: 'с. Роботине, Запорізька обл.',
          injuryMechanism: 'Осколкове поранення від мінометного обстрілу'
        },
        vitalSigns: {
          pulse: 155,
          respiratoryRate: 38,
          systolicBP: 55,
          diastolicBP: 30,
          spo2: 72,
          consciousness: 'U',
          temperature: 35.2
        },
        injuries: [
          { type: 'осколкове', location: 'живіт', severity: 'critical', description: 'Проникаюче поранення черевної порожнини з масивною кровотечею' },
          { type: 'осколкове', location: 'стегно ліве', severity: 'severe', description: 'Осколкове поранення з ушкодженням стегнової артерії' },
          { type: 'осколкове', location: 'грудна клітка', severity: 'severe', description: 'Множинні осколкові поранення грудної стінки' }
        ],
        priorAid: {
          tourniquet: true,
          tourniquetTime: '14:35',
          painRelief: 'морфін 10мг',
          ivAccess: true,
          airwayManagement: 'інтубація',
          notes: 'Масивна крововтрата, інфузія ізотонічного розчину 500мл'
        }
      },

      // B2 — Дуже тяжкий: ЧМТ, порушення дихання, без свідомості
      {
        patientData: {
          lastName: 'Гордієнко',
          firstName: 'Олексій',
          middleName: 'Сергійович',
          callSign: 'Грім',
          tokenNumber: 'UA-2025-0002',
          rank: 'солдат',
          unit: '47-ма ОМБр',
          age: 24,
          gender: 'male',
          injuryDate: new Date('2025-06-01'),
          injuryTime: '15:10',
          injuryLocation: 'с. Вербове, Запорізька обл.',
          injuryMechanism: 'Мінно-вибухова травма (підрив на ТМ-62)'
        },
        vitalSigns: {
          pulse: 140,
          respiratoryRate: 8,
          systolicBP: 70,
          diastolicBP: 40,
          spo2: 75,
          consciousness: 'P',
          temperature: 35.8
        },
        injuries: [
          { type: 'черепно-мозкова', location: 'голова', severity: 'critical', description: 'Тяжка ЧМТ, відкрита рана тім\'яної ділянки' },
          { type: 'мінно-вибухове', location: 'кінцівки нижні', severity: 'severe', description: 'Травматична ампутація лівої гомілки' },
          { type: 'контузія', location: 'загальне', severity: 'moderate', description: 'Контузія головного мозку' }
        ],
        priorAid: {
          tourniquet: true,
          tourniquetTime: '15:15',
          painRelief: 'кетамін',
          ivAccess: true,
          airwayManagement: 'назофарингеальний повітровід (NPA)',
          notes: 'Кровотечу зупинено турнікетом, шийний комір'
        }
      },

      // B3 — Тяжкий: торакальна травма з пневмотораксом
      {
        patientData: {
          lastName: 'Коваленко',
          firstName: 'Дмитро',
          middleName: 'Іванович',
          callSign: 'Козак',
          tokenNumber: 'UA-2025-0003',
          rank: 'молодший сержант',
          unit: '93-тя ОМБр',
          age: 31,
          gender: 'male',
          injuryDate: new Date('2025-06-01'),
          injuryTime: '16:00',
          injuryLocation: 'Бахмутський напрямок',
          injuryMechanism: 'Вогнепальне поранення'
        },
        vitalSigns: {
          pulse: 125,
          respiratoryRate: 32,
          systolicBP: 85,
          diastolicBP: 50,
          spo2: 82,
          consciousness: 'V',
          temperature: 36.5
        },
        injuries: [
          { type: 'вогнепальне', location: 'грудна клітка', severity: 'severe', description: 'Проникаюче вогнепальне поранення грудної клітки, напружений пневмоторакс' },
          { type: 'вогнепальне', location: 'плече праве', severity: 'moderate', description: 'Наскрізне поранення м\'якотканинне' }
        ],
        priorAid: {
          tourniquet: false,
          painRelief: 'промедол',
          ivAccess: true,
          airwayManagement: 'декомпресія голкою (2 МР)',
          notes: 'Оклюзійна пов\'язка на грудну клітку, декомпресійна голка'
        }
      },

      // B4 — Середньотяжкий: поранення кінцівок з помірною кровотечею
      {
        patientData: {
          lastName: 'Мельник',
          firstName: 'Іван',
          middleName: 'Олександрович',
          callSign: 'Мавка',
          tokenNumber: 'UA-2025-0004',
          rank: 'капрал',
          unit: '110-та ОМБр',
          age: 26,
          gender: 'male',
          injuryDate: new Date('2025-06-01'),
          injuryTime: '16:30',
          injuryLocation: 'Авдіївський напрямок',
          injuryMechanism: 'Осколкове поранення від FPV-дрона'
        },
        vitalSigns: {
          pulse: 110,
          respiratoryRate: 22,
          systolicBP: 100,
          diastolicBP: 65,
          spo2: 94,
          consciousness: 'A',
          temperature: 36.8
        },
        injuries: [
          { type: 'осколкове', location: 'стегно праве', severity: 'moderate', description: 'Осколкове поранення м\'яких тканин стегна' },
          { type: 'осколкове', location: 'передпліччя ліве', severity: 'moderate', description: 'Осколкове поранення передпліччя, перелом променевої кістки' }
        ],
        priorAid: {
          tourniquet: true,
          tourniquetTime: '16:35',
          painRelief: 'кеторолак',
          ivAccess: false,
          airwayManagement: '',
          notes: 'Турнікет на стегно, тиснуча пов\'язка на передпліччя'
        }
      },

      // B5 — Легкий: поверхневі поранення
      {
        patientData: {
          lastName: 'Сидоренко',
          firstName: 'Петро',
          middleName: 'Васильович',
          callSign: 'Сокіл',
          tokenNumber: 'UA-2025-0005',
          rank: 'солдат',
          unit: '24-та ОМБр',
          age: 22,
          gender: 'male',
          injuryDate: new Date('2025-06-01'),
          injuryTime: '17:00',
          injuryLocation: 'Купʼянський напрямок',
          injuryMechanism: 'Осколкове поранення'
        },
        vitalSigns: {
          pulse: 85,
          respiratoryRate: 16,
          systolicBP: 125,
          diastolicBP: 80,
          spo2: 98,
          consciousness: 'A',
          temperature: 36.6
        },
        injuries: [
          { type: 'осколкове', location: 'гомілка ліва', severity: 'light', description: 'Поверхневе осколкове поранення м\'яких тканин' }
        ],
        priorAid: {
          tourniquet: false,
          painRelief: 'ібупрофен',
          ivAccess: false,
          airwayManagement: '',
          notes: 'Первинна обробка рани, стерильна пов\'язка'
        }
      },

      // B6 — Дуже тяжкий: абдомінальна травма + шок
      {
        patientData: {
          lastName: 'Ткаченко',
          firstName: 'Віктор',
          middleName: 'Миколайович',
          callSign: 'Тигр',
          tokenNumber: 'UA-2025-0006',
          rank: 'сержант',
          unit: '3-тя ОШБр',
          age: 33,
          gender: 'male',
          injuryDate: new Date('2025-06-01'),
          injuryTime: '14:45',
          injuryLocation: 'с. Роботине, Запорізька обл.',
          injuryMechanism: 'Вогнепальне поранення та вибухова хвиля'
        },
        vitalSigns: {
          pulse: 145,
          respiratoryRate: 34,
          systolicBP: 65,
          diastolicBP: 35,
          spo2: 78,
          consciousness: 'V',
          temperature: 35.5
        },
        injuries: [
          { type: 'вогнепальне', location: 'живіт', severity: 'critical', description: 'Вогнепальне поранення черевної порожнини з ушкодженням печінки' },
          { type: 'вогнепальне', location: 'таз', severity: 'severe', description: 'Поранення тазової ділянки з переломом' },
          { type: 'контузія', location: 'загальне', severity: 'moderate', description: 'Контузія від вибухової хвилі' }
        ],
        priorAid: {
          tourniquet: false,
          painRelief: 'морфін 10мг',
          ivAccess: true,
          airwayManagement: 'орофарингеальний повітровід (OPA)',
          notes: 'Тазовий бандаж, масивна інфузійна терапія'
        }
      },

      // B7 — Середньотяжкий: перелом + помірні поранення
      {
        patientData: {
          lastName: 'Марченко',
          firstName: 'Олег',
          middleName: 'Валерійович',
          callSign: 'Монах',
          tokenNumber: 'UA-2025-0007',
          rank: 'старший солдат',
          unit: '92-га ОШБр',
          age: 29,
          gender: 'male',
          injuryDate: new Date('2025-06-01'),
          injuryTime: '15:30',
          injuryLocation: 'Лиманський напрямок',
          injuryMechanism: 'Мінно-вибухова травма'
        },
        vitalSigns: {
          pulse: 105,
          respiratoryRate: 24,
          systolicBP: 105,
          diastolicBP: 70,
          spo2: 92,
          consciousness: 'A',
          temperature: 37.0
        },
        injuries: [
          { type: 'мінно-вибухове', location: 'гомілка права', severity: 'severe', description: 'Відкритий перелом гомілки з ушкодженням м\'яких тканин' },
          { type: 'осколкове', location: 'спина', severity: 'moderate', description: 'Множинні поверхневі осколкові поранення спини' }
        ],
        priorAid: {
          tourniquet: true,
          tourniquetTime: '15:35',
          painRelief: 'кетамін',
          ivAccess: true,
          airwayManagement: '',
          notes: 'Іммобілізація кінцівки, знеболення'
        }
      },

      // B8 — Помірний: вогнепальне поранення плеча
      {
        patientData: {
          lastName: 'Литвин',
          firstName: 'Максим',
          middleName: 'Романович',
          callSign: 'Лис',
          tokenNumber: 'UA-2025-0008',
          rank: 'молодший лейтенант',
          unit: '47-ма ОМБр',
          age: 25,
          gender: 'male',
          injuryDate: new Date('2025-06-01'),
          injuryTime: '17:15',
          injuryLocation: 'с. Вербове, Запорізька обл.',
          injuryMechanism: 'Вогнепальне поранення (снайпер)'
        },
        vitalSigns: {
          pulse: 98,
          respiratoryRate: 20,
          systolicBP: 110,
          diastolicBP: 72,
          spo2: 95,
          consciousness: 'A',
          temperature: 36.9
        },
        injuries: [
          { type: 'вогнепальне', location: 'плече ліве', severity: 'moderate', description: 'Наскрізне вогнепальне поранення плеча без ушкодження кістки' },
          { type: 'осколкове', location: 'обличчя', severity: 'light', description: 'Поверхневі осколкові поранення обличчя' }
        ],
        priorAid: {
          tourniquet: false,
          painRelief: 'промедол',
          ivAccess: false,
          airwayManagement: '',
          notes: 'Тиснуча пов\'язка на плече, обробка ран обличчя'
        }
      },

      // B9 — Тяжкий: ЧМТ з помірними вітальними порушеннями
      {
        patientData: {
          lastName: 'Василенко',
          firstName: 'Артем',
          middleName: 'Дмитрович',
          callSign: 'Вепр',
          tokenNumber: 'UA-2025-0009',
          rank: 'сержант',
          unit: '93-тя ОМБр',
          age: 27,
          gender: 'male',
          injuryDate: new Date('2025-06-01'),
          injuryTime: '16:15',
          injuryLocation: 'Бахмутський напрямок',
          injuryMechanism: 'Вибухова хвиля та удар об укриття'
        },
        vitalSigns: {
          pulse: 118,
          respiratoryRate: 26,
          systolicBP: 90,
          diastolicBP: 55,
          spo2: 88,
          consciousness: 'V',
          temperature: 36.2
        },
        injuries: [
          { type: 'черепно-мозкова', location: 'голова', severity: 'severe', description: 'Закрита ЧМТ, забій головного мозку' },
          { type: 'перелом', location: 'ребра', severity: 'moderate', description: 'Перелом 5–7 ребер зліва' }
        ],
        priorAid: {
          tourniquet: false,
          painRelief: 'кеторолак',
          ivAccess: true,
          airwayManagement: 'позиція відновлення',
          notes: 'Шийний комір, контроль прохідності дихальних шляхів'
        }
      },

      // B10 — Найлегший: контузія
      {
        patientData: {
          lastName: 'Яковенко',
          firstName: 'Сергій',
          middleName: 'Андрійович',
          callSign: 'Яструб',
          tokenNumber: 'UA-2025-0010',
          rank: 'солдат',
          unit: '110-та ОМБр',
          age: 21,
          gender: 'male',
          injuryDate: new Date('2025-06-01'),
          injuryTime: '18:00',
          injuryLocation: 'Авдіївський напрямок',
          injuryMechanism: 'Контузія від близького вибуху'
        },
        vitalSigns: {
          pulse: 80,
          respiratoryRate: 15,
          systolicBP: 130,
          diastolicBP: 82,
          spo2: 99,
          consciousness: 'A',
          temperature: 36.6
        },
        injuries: [
          { type: 'контузія', location: 'загальне', severity: 'light', description: 'Легка контузія, головний біль, шум у вухах' }
        ],
        priorAid: {
          tourniquet: false,
          painRelief: 'парацетамол',
          ivAccess: false,
          airwayManagement: '',
          notes: 'Спостереження, амбулаторне лікування'
        }
      }
    ];

    // ============================
    // Створення карток з AHP-сортуванням
    // ============================
    console.log('\n📋 Створення карток поранених та виконання AHP-сортування...\n');

    const createdCasualties = [];

    for (let i = 0; i < casualtyDataArray.length; i++) {
      const data = casualtyDataArray[i];
      const label = `B${i + 1}`;

      // Виконуємо AHP-сортування
      const triageResult = runTriageForPatient(data);

      const casualty = await CasualtyCard.create({
        ...data,
        triageCategory: triageResult.triageCategory,
        triageScore: triageResult.triageScore,
        ahpDetails: triageResult.ahpDetails,
        createdBy: medicUser._id,
        lastUpdatedBy: doctorUser._id,
        changeHistory: [
          {
            user: medicUser._id,
            action: 'Створено',
            details: `Картку ${label} створено при первинному сортуванні. Категорія: ${triageResult.triageCategory.toUpperCase()} (бал: ${triageResult.triageScore}). ${triageResult.triageDescription}`,
            date: new Date()
          }
        ]
      });

      createdCasualties.push({
        label,
        casualty,
        triageResult
      });

      const categoryColors = {
        red: '🔴',
        yellow: '🟡',
        green: '🟢',
        black: '⚫'
      };

      const icon = categoryColors[triageResult.triageCategory] || '⚪';
      console.log(
        `   ${icon} ${label}: ${data.patientData.lastName} ${data.patientData.firstName} (${data.patientData.callSign}) — ` +
        `${triageResult.triageCategory.toUpperCase()} (бал: ${triageResult.triageScore})`
      );
    }

    // ============================
    // Ранжування всіх пацієнтів
    // ============================
    console.log('\n📊 Результати ранжування AHP (від найвищого пріоритету):');
    console.log('─'.repeat(80));

    const allTriageResults = runTriageForAll(casualtyDataArray.map((d, i) => ({
      ...d,
      _id: createdCasualties[i].casualty._id
    })));

    for (const result of allTriageResults) {
      const origIndex = createdCasualties.findIndex(
        (c) => c.casualty._id.toString() === result.casualtyId.toString()
      );
      const label = origIndex >= 0 ? `B${origIndex + 1}` : '?';

      const categoryColors = {
        red: '🔴',
        yellow: '🟡',
        green: '🟢',
        black: '⚫'
      };
      const icon = categoryColors[result.triageCategory] || '⚪';

      console.log(
        `   ${result.rank}. ${icon} ${label} — ${result.patientName} — ` +
        `${result.triageCategory.toUpperCase()} (бал: ${result.triageScore})`
      );
    }

    console.log('─'.repeat(80));
    console.log(`   Очікуваний порядок: B1–B2–B6–B3–B9–B4–B7–B8–B5–B10`);
    console.log(`   Фактичний порядок:  ${allTriageResults.map((r) => {
      const idx = createdCasualties.findIndex(
        (c) => c.casualty._id.toString() === r.casualtyId.toString()
      );
      return `B${idx + 1}`;
    }).join('–')}`);

    // ============================
    // Перевірка узгодженості матриці
    // ============================
    const { calculateCriteriaWeights } = require('./services/triageAHP');
    const { weightMap, consistency } = calculateCriteriaWeights();

    console.log('\n⚖️  Ваги критеріїв AHP:');
    for (const [key, value] of Object.entries(weightMap)) {
      const bar = '█'.repeat(Math.round(value * 50));
      console.log(`   ${key}: ${value.toFixed(4)} ${bar}`);
    }

    console.log(`\n🔍 Перевірка узгодженості матриці:`);
    console.log(`   λmax = ${consistency.lambdaMax}`);
    console.log(`   CI = ${consistency.CI}`);
    console.log(`   RI = ${consistency.RI}`);
    console.log(`   CR = ${consistency.CR} ${consistency.isConsistent ? '✅ (≤ 0.1 — матриця узгоджена)' : '❌ (> 0.1 — матриця НЕ узгоджена)'}`);

    // ============================
    // Підсумок
    // ============================
    console.log('\n' + '═'.repeat(80));
    console.log('✅ Наповнення бази даних завершено!');
    console.log('═'.repeat(80));
    console.log(`   Користувачів: ${users.length}`);
    console.log(`   Госпіталів:   ${hospitals.length}`);
    console.log(`   Поранених:    ${createdCasualties.length}`);
    console.log('\n   Облікові записи для входу:');
    console.log('   ─────────────────────────────────────────');
    console.log('   admin@medsort.ua  / admin123  (адміністратор)');
    console.log('   doctor@medsort.ua / doctor123 (лікар)');
    console.log('   medic@medsort.ua  / medic123  (бойовий медик)');
    console.log('');

  } catch (error) {
    console.error('❌ Помилка наповнення бази даних:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 З\'єднання з MongoDB закрито');
    process.exit(0);
  }
}

seed();
