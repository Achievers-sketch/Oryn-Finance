const crypto = require('crypto');
const logger = require('../config/logger');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

class EncryptionService {
  constructor() {
    this.masterKey = null;
    this.userKeys = new Map();
  }

  initialize() {
    const envKey = process.env.ENCRYPTION_MASTER_KEY;
    if (envKey) {
      this.masterKey = Buffer.from(envKey, 'hex');
    } else {
      this.masterKey = crypto.randomBytes(KEY_LENGTH);
      logger.warn('No ENCRYPTION_MASTER_KEY set; generated ephemeral master key');
    }

    if (this.masterKey.length !== KEY_LENGTH) {
      throw new Error(`Master key must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars)`);
    }

    logger.info('EncryptionService initialized');
  }

  generateUserKeypair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519', {
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'der' }
    });
    return {
      publicKey: publicKey.toString('base64'),
      privateKey: privateKey.toString('base64')
    };
  }

  deriveSharedSecret(privateKeyDer, publicKeyDer) {
    const privateKey = crypto.createPrivateKey({
      key: Buffer.from(privateKeyDer, 'base64'),
      type: 'pkcs8',
      format: 'der'
    });
    const publicKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyDer, 'base64'),
      type: 'spki',
      format: 'der'
    });
    return crypto.diffieHellman({ privateKey, publicKey });
  }

  encryptMessage(plaintext, sharedSecret) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = crypto.createHash('sha256').update(sharedSecret).digest();

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      iv: iv.toString('hex'),
      encryptedData: encrypted,
      authTag
    };
  }

  decryptMessage(ciphertext, sharedSecret) {
    const key = crypto.createHash('sha256').update(sharedSecret).digest();
    const iv = Buffer.from(ciphertext.iv, 'hex');
    const authTag = Buffer.from(ciphertext.authTag, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  encryptForStorage(plaintext) {
    if (!this.masterKey) {
      throw new Error('EncryptionService not initialized');
    }
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return JSON.stringify({ iv: iv.toString('hex'), encryptedData: encrypted, authTag });
  }

  decryptFromStorage(stored) {
    if (!this.masterKey) {
      throw new Error('EncryptionService not initialized');
    }
    const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
    const iv = Buffer.from(parsed.iv, 'hex');
    const authTag = Buffer.from(parsed.authTag, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(parsed.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  hashConversationId(participants) {
    const sorted = [...participants].sort().join(':');
    return crypto.createHash('sha256').update(sorted).digest('hex');
  }
}

module.exports = new EncryptionService();
