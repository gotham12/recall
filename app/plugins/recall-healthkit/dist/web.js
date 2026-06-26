export class RecallHealthkitWeb {
  async isAvailable() {
    return { available: false };
  }

  async requestAuthorization() {
    throw new Error('HealthKit is only available in the Recall iOS app.');
  }

  async readLatestVitals() {
    throw new Error('HealthKit is only available in the Recall iOS app.');
  }
}
