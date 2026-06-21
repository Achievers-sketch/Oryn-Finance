const { AuditLog } = require('../models');
const auditService = require('../services/auditService');
const logger = require('../config/logger');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * AuditController (Issue #194)
 *
 * Read/export surface for the centralized audit log. All endpoints are
 * admin-protected at the route layer. Provides:
 *   - paginated, filterable querying (the data source for the log viewer)
 *   - aggregate statistics for the dashboard
 *   - export of logs as JSON or CSV
 */
class AuditController {
  /**
   * Build a mongo filter from common query params.
   */
  static buildFilter(query = {}) {
    const { category, action, status, actor, target, startDate, endDate } = query;
    const filter = {};

    if (category) filter.category = category;
    if (action) filter.action = action;
    if (status) filter.status = status;
    if (actor) filter['actor.walletAddress'] = actor.toLowerCase();
    if (target) filter['target.id'] = target;

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    return filter;
  }

  /**
   * GET /api/audit
   * Paginated, filterable list of audit entries — powers the log viewer.
   */
  static async getLogs(req, res) {
    try {
      const { limit = 50, page = 1 } = req.query;
      const parsedLimit = Math.min(parseInt(limit, 10) || 50, 200);
      const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
      const skip = (parsedPage - 1) * parsedLimit;

      const filter = AuditController.buildFilter(req.query);

      const [logs, total] = await Promise.all([
        AuditLog.find(filter)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(parsedLimit)
          .lean(),
        AuditLog.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            page: parsedPage,
            limit: parsedLimit,
            total,
            pages: Math.ceil(total / parsedLimit)
          }
        }
      });
    } catch (error) {
      logger.error('getLogs failed:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
    }
  }

  /**
   * GET /api/audit/stats
   * Aggregate statistics for the dashboard (totals, breakdown, recent failures).
   */
  static async getStats(req, res) {
    try {
      const now = new Date();
      const last24h = new Date(now - 24 * 60 * 60 * 1000);

      const [total, byCategory, byStatus, recentFailures, events24h] = await Promise.all([
        AuditLog.countDocuments({}),
        AuditLog.getCategoryCounts(),
        AuditLog.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        AuditLog.find({ status: 'failure' })
          .sort({ timestamp: -1 })
          .limit(10)
          .lean(),
        AuditLog.countDocuments({ timestamp: { $gte: last24h } })
      ]);

      const statusMap = byStatus.reduce((acc, s) => {
        acc[s._id] = s.count;
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          total,
          events24h,
          byCategory: byCategory.map((c) => ({ category: c._id, count: c.count })),
          byStatus: statusMap,
          recentFailures
        }
      });
    } catch (error) {
      logger.error('getStats failed:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch audit stats' });
    }
  }

  /**
   * GET /api/audit/export?format=json|csv
   * Export filtered audit logs. Defaults to JSON; CSV is downloadable.
   */
  static async exportLogs(req, res) {
    try {
      const format = (req.query.format || 'json').toLowerCase();
      if (!['json', 'csv'].includes(format)) {
        throw new ValidationError('format must be "json" or "csv"');
      }

      const maxExport = Math.min(parseInt(req.query.limit, 10) || 10000, 50000);
      const filter = AuditController.buildFilter(req.query);

      const logs = await AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .limit(maxExport)
        .lean();

      const stamp = new Date().toISOString().slice(0, 10);

      // Record the export itself — exporting an audit trail is itself auditable.
      await auditService.admin(req, {
        action: 'admin.action',
        description: `Exported ${logs.length} audit log(s) as ${format.toUpperCase()}`,
        metadata: { format, count: logs.length, filter }
      });

      if (format === 'csv') {
        const csv = auditService.toCSV(logs);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${stamp}.csv"`);
        return res.send(csv);
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${stamp}.json"`);
      return res.send(JSON.stringify({ exportedAt: new Date().toISOString(), count: logs.length, logs }, null, 2));
    } catch (error) {
      logger.error('exportLogs failed:', error);
      throw error;
    }
  }
}

module.exports = AuditController;
