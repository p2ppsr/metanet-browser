import * as Analytics from 'expo-firebase-analytics'

export const logEvent = async (eventName: string, params?: Record<string, any>) => {
  try {
    const safeParams: Record<string, string | number> = {}

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          safeParams[key] = typeof value === 'string' || typeof value === 'number'
            ? value
            : String(value)
        }
      }
    }

    await Analytics.logEvent(eventName, safeParams)
    console.log(`[Analytics] ${eventName}`, safeParams)
  } catch (err) {
    console.warn(`[Analytics Error] ${eventName}`, err)
  }
}
