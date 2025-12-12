/**
 * Indicates whether the application is running in development mode.
 *
 * This constant is used internally to conditionally execute code that should
 * only run during development, such as logging warnings or performing validations.
 * In production builds, bundlers like Webpack or Vite will replace
 * `process.env.NODE_ENV` with `"production"`, allowing dead code elimination
 * to remove development-only code paths.
 */
export const isDevelopment: boolean = process.env.NODE_ENV !== "production";

/**
 * Logs a warning message to the console in development mode only.
 *
 * This utility function is useful for displaying warnings about incorrect usage,
 * deprecated features, or potential issues that developers should be aware of
 * during development. In production builds, these warnings are automatically
 * removed through tree-shaking, resulting in zero runtime cost.
 *
 * @param message - The warning message to log.
 *
 * @example
 * ```typescript
 * if (value === undefined) {
 *   warnInDevelopment("Value should not be undefined. Using default value instead.");
 * }
 * ```
 *
 * @example
 * ```typescript
 * warnInDevelopment(
 *   `Component "${componentName}" is changing from controlled to uncontrolled mode.`
 * );
 * ```
 */
export const warnInDevelopment = (message: string) => {
  if (isDevelopment) {
    console.warn(message);
  }
};

/**
 * Logs an error message to the console in development mode only.
 *
 * This utility function is useful for displaying error messages about critical
 * issues or validation failures that developers need to address during development.
 * Unlike `warnInDevelopment`, this uses `console.error` to indicate a more severe
 * issue. In production builds, these error logs are automatically removed through
 * tree-shaking, resulting in zero runtime cost.
 *
 * @param message - The error message to log.
 *
 * @example
 * ```typescript
 * if (!isValidConfig(config)) {
 *   errorInDevelopment("Invalid configuration detected. Please check your setup.");
 * }
 * ```
 *
 * @example
 * ```typescript
 * errorInDevelopment(
 *   `Failed to initialize hook: required parameter "callback" is missing.`
 * );
 * ```
 */
export const errorInDevelopment = (message: string) => {
  if (isDevelopment) {
    console.error(message);
  }
};
