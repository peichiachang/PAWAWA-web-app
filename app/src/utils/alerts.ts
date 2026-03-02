import { MedicalAlert } from '../types/domain';
import { NORMAL_TEMP_MAX_C, NORMAL_TEMP_MIN_C } from './health';

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function checkTemperatureAlert(catId: string, temperatureC: number, timestamp: string): MedicalAlert | null {
  if (temperatureC >= NORMAL_TEMP_MIN_C && temperatureC <= NORMAL_TEMP_MAX_C) {
    return null;
  }
  return {
    alertId: makeId('temp'),
    catId,
    type: 'fever',
    severity: 'high',
    message: `Body temperature out of range: ${temperatureC.toFixed(1)} C`,
    timestamp,
  };
}

export function checkIntakeAlert(
  catId: string,
  intakeKcal: number,
  bmrKcal: number,
  timestamp: string
): MedicalAlert | null {
  if (bmrKcal <= 0) {
    return null;
  }
  if (intakeKcal >= bmrKcal * 0.7) {
    return null;
  }
  return {
    alertId: makeId('intake'),
    catId,
    type: 'intake',
    severity: 'medium',
    message: `Intake below 70% BMR (${intakeKcal.toFixed(0)} / ${bmrKcal.toFixed(0)} kcal)`,
    timestamp,
  };
}

export function checkWeeklyWeightAlert(
  catId: string,
  weeklyWeightChangeRatePct: number,
  timestamp: string
): MedicalAlert | null {
  if (weeklyWeightChangeRatePct >= -2) {
    return null;
  }
  return {
    alertId: makeId('weight'),
    catId,
    type: 'weight',
    severity: 'high',
    message: `Weight loss rate too fast (${weeklyWeightChangeRatePct.toFixed(2)}% / week)`,
    timestamp,
  };
}
