/**
 * Provides a structured way to access environment variables throughout the application.
 *
 * This module reads environment variables from Vite's `import.meta.env` and
 * exports them in a typed object, ensuring consistency and providing default
 * values for essential variables.
 */

interface Env {
  /** The base URL for the API. */
  apiBaseUrl: string
  /** A boolean indicating if the application is in development mode. */
  isDevelopment: boolean
  /** A boolean indicating if the application is in production mode. */
  isProduction: boolean
}

/**
 * An object containing the environment variables for the application.
 *
 * @property {string} apiBaseUrl The base URL for the API. Defaults to empty string (use relative URLs).
 * @property {boolean} isDevelopment True if the application is in development mode.
 * @property {boolean} isProduction True if the application is in production mode.
 */
export const env: Env = {
  apiBaseUrl: import.meta.env.VITE_API_URL || '',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
}
