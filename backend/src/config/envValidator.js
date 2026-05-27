const logger = require('./logger');

const ENV_RULES = [
  {
    key: 'JWT_SECRET',
    required: true,
    validate: (v) => v.length >= 32,
    hint: 'Must be at least 32 characters long',
  },
  {
    key: 'MONGODB_URI',
    required: true,
    validate: (v) => v.startsWith('mongodb://') || v.startsWith('mongodb+srv://'),
    hint: 'Must be a valid MongoDB connection string',
  },
  {
    key: 'NODE_ENV',
    required: false,
    validate: (v) => ['development', 'production', 'test'].includes(v),
    hint: 'Must be development, production, or test',
  },
  {
    key: 'PORT',
    required: false,
    validate: (v) => {
      const n = parseInt(v, 10);
      return !isNaN(n) && n > 0 && n < 65536;
    },
    hint: 'Must be a valid port number (1-65535)',
  },
  {
    key: 'FRONTEND_URL',
    required: false,
    validate: (v) => {
      try {
        new URL(v);
        return true;
      } catch {
        return false;
      }
    },
    hint: 'Must be a valid URL',
  },
];

function validateEnv() {
  const errors = [];
  const warnings = [];

  for (const rule of ENV_RULES) {
    const value = process.env[rule.key];

    if (!value || value.trim() === '') {
      if (rule.required) {
        errors.push(`${rule.key} is required but not set. ${rule.hint || ''}`);
      } else {
        warnings.push(`${rule.key} is not set — using default. ${rule.hint || ''}`);
      }
      continue;
    }

    if (rule.validate && !rule.validate(value)) {
      if (rule.required) {
        errors.push(`${rule.key} has an invalid value. ${rule.hint || ''}`);
      } else {
        warnings.push(`${rule.key} may be misconfigured. ${rule.hint || ''}`);
      }
    }
  }

  for (const msg of warnings) {
    logger.warn(`[ENV] ${msg}`);
  }

  if (errors.length > 0) {
    for (const msg of errors) {
      logger.error(`[ENV] ${msg}`);
    }
    logger.error('[ENV] Server startup aborted due to missing required environment variables.');
    process.exit(1);
  }

  logger.info('[ENV] Environment validation passed.');
}

module.exports = { validateEnv };
