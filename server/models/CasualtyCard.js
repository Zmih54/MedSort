const mongoose = require('mongoose');

const injurySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      trim: true
    },
    location: {
      type: String,
      trim: true
    },
    severity: {
      type: String,
      enum: {
        values: ['light', 'moderate', 'severe', 'critical'],
        message: 'Ступінь тяжкості {VALUE} не підтримується'
      }
    },
    description: {
      type: String,
      trim: true
    }
  },
  { _id: false }
);

const changeHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    action: {
      type: String,
      required: true
    },
    details: {
      type: String
    },
    date: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const casualtyCardSchema = new mongoose.Schema(
  {
    patientData: {
      lastName: { type: String, trim: true },
      firstName: { type: String, trim: true },
      middleName: { type: String, trim: true },
      callSign: { type: String, trim: true },
      tokenNumber: { type: String, trim: true },
      rank: { type: String, trim: true },
      unit: { type: String, trim: true },
      age: { type: Number, min: 0, max: 120 },
      gender: {
        type: String,
        enum: {
          values: ['male', 'female'],
          message: 'Стать {VALUE} не підтримується'
        }
      },
      injuryDate: { type: Date },
      injuryTime: { type: String },
      injuryLocation: { type: String, trim: true },
      injuryMechanism: { type: String, trim: true }
    },

    vitalSigns: {
      pulse: { type: Number, min: 0, max: 300 },
      respiratoryRate: { type: Number, min: 0, max: 80 },
      systolicBP: { type: Number, min: 0, max: 300 },
      diastolicBP: { type: Number, min: 0, max: 200 },
      spo2: { type: Number, min: 0, max: 100 },
      consciousness: {
        type: String,
        enum: {
          values: ['A', 'V', 'P', 'U'],
          message: 'Рівень свідомості {VALUE} не підтримується (використовуйте AVPU)'
        }
      },
      temperature: { type: Number, min: 20, max: 45 }
    },

    injuries: [injurySchema],

    priorAid: {
      tourniquet: { type: Boolean, default: false },
      tourniquetTime: { type: String },
      painRelief: { type: String, trim: true },
      ivAccess: { type: Boolean, default: false },
      airwayManagement: { type: String, trim: true },
      notes: { type: String, trim: true }
    },

    triageCategory: {
      type: String,
      enum: {
        values: ['red', 'yellow', 'green', 'black'],
        message: 'Категорія сортування {VALUE} не підтримується'
      }
    },

    triageScore: {
      type: Number
    },

    ahpDetails: {
      criteriaWeights: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      },
      patientScores: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      },
      globalPriority: {
        type: Number
      }
    },

    status: {
      type: String,
      enum: {
        values: ['active', 'closed', 'archived'],
        message: 'Статус {VALUE} не підтримується'
      },
      default: 'active'
    },

    assignedHospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital'
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    changeHistory: [changeHistorySchema]
  },
  {
    timestamps: true
  }
);

// Індекси для швидкого пошуку
casualtyCardSchema.index({ triageCategory: 1 });
casualtyCardSchema.index({ status: 1 });
casualtyCardSchema.index({ 'patientData.lastName': 1 });
casualtyCardSchema.index({ createdAt: -1 });

module.exports = mongoose.model('CasualtyCard', casualtyCardSchema);
