// Mock the AuditLog model so record() can be exercised without a database.
jest.mock('../../src/models/AuditLog', () => ({
  create: jest.fn().mockResolvedValue({ toObject: () => ({ eventId: 'audit_test' }) }),
}));

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const AuditLog = require('../../src/models/AuditLog');
const auditService = require('../../src/services/auditService');

describe('auditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveActor', () => {
    test('extracts actor info from an express request', () => {
      const req = {
        user: { walletAddress: 'GABC', userData: { isAdmin: true } },
        ip: '10.0.0.1',
        headers: { 'user-agent': 'jest' },
      };
      const actor = auditService.resolveActor(req);
      expect(actor.walletAddress).toBe('GABC');
      expect(actor.isAdmin).toBe(true);
      expect(actor.ip).toBe('10.0.0.1');
      expect(actor.userAgent).toBe('jest');
    });

    test('extracts actor info from a plain object', () => {
      const actor = auditService.resolveActor({ walletAddress: 'GXYZ', isAdmin: false, ip: '1.1.1.1' });
      expect(actor.walletAddress).toBe('GXYZ');
      expect(actor.isAdmin).toBe(false);
      expect(actor.ip).toBe('1.1.1.1');
    });

    test('returns null actor fields when nothing provided', () => {
      const actor = auditService.resolveActor();
      expect(actor.walletAddress).toBeNull();
      expect(actor.isAdmin).toBe(false);
    });
  });

  describe('record', () => {
    test('persists an entry and mirrors it to the logger', async () => {
      const result = await auditService.record({
        category: 'authentication',
        action: 'auth.login',
        actor: { walletAddress: 'GABC' },
        description: 'login',
      });

      expect(AuditLog.create).toHaveBeenCalledTimes(1);
      const created = AuditLog.create.mock.calls[0][0];
      expect(created.category).toBe('authentication');
      expect(created.action).toBe('auth.login');
      expect(created.status).toBe('success');
      expect(created.actor.walletAddress).toBe('GABC');
      expect(result).toEqual({ eventId: 'audit_test' });
    });

    test('never throws when persistence fails', async () => {
      AuditLog.create.mockRejectedValueOnce(new Error('db down'));
      const result = await auditService.record({ category: 'system', action: 'system.event' });
      expect(result).toBeNull();
    });
  });

  describe('convenience helpers', () => {
    test('auth() marks failed logins as failure', async () => {
      await auditService.auth('auth.login_failed', { walletAddress: 'GABC' });
      expect(AuditLog.create.mock.calls[0][0].status).toBe('failure');
    });

    test('transaction() defaults to success', async () => {
      await auditService.transaction('transaction.created', { walletAddress: 'GABC' });
      expect(AuditLog.create.mock.calls[0][0].status).toBe('success');
    });

    test('admin() uses provided action', async () => {
      await auditService.admin({ walletAddress: 'GABC' }, { action: 'admin.access_denied', status: 'failure' });
      const created = AuditLog.create.mock.calls[0][0];
      expect(created.category).toBe('admin');
      expect(created.action).toBe('admin.access_denied');
      expect(created.status).toBe('failure');
    });
  });

  describe('toCSV', () => {
    const entries = [
      {
        eventId: 'audit_1',
        timestamp: new Date('2026-01-01T00:00:00Z'),
        category: 'authentication',
        action: 'auth.login',
        status: 'success',
        actor: { walletAddress: 'GABC', isAdmin: false, ip: '1.1.1.1' },
        target: { type: 'user', id: 'u1' },
        description: 'User logged in',
        metadata: { foo: 'bar' },
      },
    ];

    test('produces a header row and one row per entry', () => {
      const csv = auditService.toCSV(entries);
      const lines = csv.split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain('eventId');
      expect(lines[0]).toContain('metadata');
      expect(lines[1]).toContain('audit_1');
      expect(lines[1]).toContain('auth.login');
    });

    test('escapes values containing commas and quotes', () => {
      const csv = auditService.toCSV([
        {
          eventId: 'audit_2',
          timestamp: new Date('2026-01-01T00:00:00Z'),
          category: 'system',
          action: 'system.event',
          status: 'success',
          description: 'has, comma and "quote"',
          metadata: {},
        },
      ]);
      const row = csv.split('\n')[1];
      expect(row).toContain('"has, comma and ""quote"""');
    });

    test('handles an empty list', () => {
      const csv = auditService.toCSV([]);
      expect(csv.split('\n')).toHaveLength(1); // header only
    });
  });
});
