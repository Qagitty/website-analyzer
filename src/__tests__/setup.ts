import '@testing-library/jest-dom';

// Encryption secrets required for key generation / reveal tests.
// These are fake test-only values; never use in production.
process.env.API_KEY_ENCRYPTION_SECRET = '0'.repeat(32);
process.env.PBKDF2_SALT = 'test-salt-00000000000000000000000000';
