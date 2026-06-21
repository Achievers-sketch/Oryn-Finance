jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../src/models/AuditLog', () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
  getCategoryCounts: jest.fn(),
}));

jest.mock('../../src/services/auditService', () => ({
  admin: jest.fn().mockResolvedValue(null),
  toCSV: jest.fn().mockReturnValue('eventId\naudit_1'),
}));

const AuditLog = require('../../src/models/AuditLog');
const auditService = require('../../src/services/auditService');
const AuditController = require('../../src/controllers/auditController');

const mockResponse = () => {
  const res = {};
  res.json = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
};

const findChain = (value) => ({
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(value),
});

describe('AuditController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildFilter', () => {
    test('maps query params to a mongo filter', () => {
      const filter = AuditController.buildFilter({
        category: 'authentication',
        status: 'failure',
        actor: 'GABC',
        startDate: '2026-01-01',
      });
      expect(filter.category).toBe('authentication');
      expect(filter.status).toBe('failure');
      expect(filter['actor.walletAddress']).toBe('gabc');
      expect(filter.timestamp.$gte).toBeInstanceOf(Date);
    });

    test('returns an empty filter when no params', () => {
      expect(AuditController.buildFilter()).toEqual({});
    });
  });

  describe('getLogs', () => {
    test('returns paginated logs', async () => {
      AuditLog.find.mockReturnValue(findChain([{ eventId: 'audit_1' }]));
      AuditLog.countDocuments.mockResolvedValue(1);

      const req = { query: { page: '1', limit: '25' } };
      const res = mockResponse();

      await AuditController.getLogs(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            logs: [{ eventId: 'audit_1' }],
            pagination: expect.objectContaining({ total: 1, page: 1 }),
          }),
        })
      );
    });

    test('caps the page size at 200', async () => {
      const chain = findChain([]);
      AuditLog.find.mockReturnValue(chain);
      AuditLog.countDocuments.mockResolvedValue(0);

      await AuditController.getLogs({ query: { limit: '5000' } }, mockResponse());

      expect(chain.limit).toHaveBeenCalledWith(200);
    });
  });

  describe('getStats', () => {
    test('aggregates dashboard statistics', async () => {
      AuditLog.countDocuments.mockResolvedValue(42);
      AuditLog.getCategoryCounts.mockResolvedValue([{ _id: 'authentication', count: 10 }]);
      AuditLog.aggregate.mockResolvedValue([{ _id: 'success', count: 40 }, { _id: 'failure', count: 2 }]);
      AuditLog.find.mockReturnValue(findChain([{ eventId: 'fail_1' }]));

      const res = mockResponse();
      await AuditController.getStats({}, res);

      const payload = res.json.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.data.total).toBe(42);
      expect(payload.data.byStatus.success).toBe(40);
      expect(payload.data.byCategory[0]).toEqual({ category: 'authentication', count: 10 });
    });
  });

  describe('exportLogs', () => {
    test('exports CSV with a download header', async () => {
      AuditLog.find.mockReturnValue(findChain([{ eventId: 'audit_1' }]));

      const req = { query: { format: 'csv' }, user: { walletAddress: 'GADMIN' } };
      const res = mockResponse();

      await AuditController.exportLogs(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(auditService.toCSV).toHaveBeenCalled();
      expect(auditService.admin).toHaveBeenCalled();
      expect(res.send).toHaveBeenCalledWith('eventId\naudit_1');
    });

    test('exports JSON by default', async () => {
      AuditLog.find.mockReturnValue(findChain([{ eventId: 'audit_1' }]));

      const req = { query: {}, user: { walletAddress: 'GADMIN' } };
      const res = mockResponse();

      await AuditController.exportLogs(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      const sent = res.send.mock.calls[0][0];
      expect(sent).toContain('audit_1');
    });

    test('rejects an invalid format', async () => {
      const req = { query: { format: 'xml' }, user: { walletAddress: 'GADMIN' } };
      await expect(AuditController.exportLogs(req, mockResponse())).rejects.toThrow(/format/);
    });
  });
});
