const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Назва госпіталю є обов'язковою"],
      trim: true
    },
    location: {
      type: String,
      trim: true
    },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number }
    },
    specializations: {
      type: [String],
      default: [],
      validate: {
        validator: function (arr) {
          const allowed = [
            'хірургія',
            'нейрохірургія',
            'реанімація',
            'травматологія',
            'торакальна',
            'опікова',
            'судинна',
            'ортопедія'
          ];
          return arr.every((s) => allowed.includes(s));
        },
        message: 'Невідома спеціалізація'
      }
    },
    totalCapacity: {
      type: Number,
      required: [true, "Загальна місткість є обов'язковою"],
      min: [0, "Місткість не може бути від'ємною"]
    },
    currentLoad: {
      type: Number,
      default: 0,
      min: [0, "Завантаженість не може бути від'ємною"]
    },
    distance: {
      type: Number,
      min: [0, "Відстань не може бути від'ємною"]
    },
    contactPhone: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Віртуальне поле: доступна місткість
hospitalSchema.virtual('availableCapacity').get(function () {
  return this.totalCapacity - this.currentLoad;
});

// Віртуальне поле: відсоток завантаженості
hospitalSchema.virtual('loadPercentage').get(function () {
  if (this.totalCapacity === 0) return 100;
  return Math.round((this.currentLoad / this.totalCapacity) * 100);
});

module.exports = mongoose.model('Hospital', hospitalSchema);
