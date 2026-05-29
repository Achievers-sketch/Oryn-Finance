/**
 * Custom Market Alerts Controller
 * Issue #138: Alert on price movement, liquidity changes, market resolution
 */
const logger = require('../config/logger');

// In-memory store for non-DB mode
const alertStore = new Map(); // key: `${wallet}:${marketId}:${type}`

function alertKey(wallet, marketId, type) {
  return `${wallet.toLowerCase()}:${marketId}:${type}`;
}

const VALID_TYPES = ['price_movement', 'liquidity_change', 'market_resolution'];

class MarketAlertsController {
  /**
   * GET /api/alerts
   * List all alerts for the authenticated user
   */
  static async listAlerts(req, res) {
    try {
      const wallet = req.user?.walletAddress?.toLowerCase();
      if (!wallet) return res.status(401).json({ success: false, message: 'Authentication required' });

      const alerts = [...alertStore.values()].filter((a) => a.userWalletAddress === wallet);
      return res.json({ success: true, data: alerts });
    } catch (error) {
      logger.error('listAlerts error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/alerts
   * Body: { marketId, alertType, threshold? }
   */
  static async createAlert(req, res) {
    try {
      const wallet = req.user?.walletAddress?.toLowerCase();
      if (!wallet) return res.status(401).json({ success: false, message: 'Authentication required' });

      const { marketId, alertType, threshold } = req.body;
      if (!marketId) return res.status(400).json({ success: false, message: 'marketId required' });
      if (!VALID_TYPES.includes(alertType)) {
        return res.status(400).json({ success: false, message: `alertType must be one of: ${VALID_TYPES.join(', ')}` });
      }

      const key = alertKey(wallet, marketId, alertType);
      if (alertStore.has(key)) {
        return res.status(409).json({ success: false, message: 'Alert already exists' });
      }

      const alert = {
        id: key,
        userWalletAddress: wallet,
        marketId,
        alertType,
        threshold: threshold ?? null,
        active: true,
        createdAt: new Date(),
        lastTriggeredAt: null,
      };
      alertStore.set(key, alert);
      logger.info('Market alert created', { wallet, marketId, alertType });
      return res.status(201).json({ success: true, data: alert });
    } catch (error) {
      logger.error('createAlert error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * DELETE /api/alerts/:alertId
   */
  static async deleteAlert(req, res) {
    try {
      const wallet = req.user?.walletAddress?.toLowerCase();
      if (!wallet) return res.status(401).json({ success: false, message: 'Authentication required' });

      const { alertId } = req.params;
      const alert = alertStore.get(alertId);
      if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
      if (alert.userWalletAddress !== wallet) return res.status(403).json({ success: false, message: 'Forbidden' });

      alertStore.delete(alertId);
      return res.json({ success: true, message: 'Alert deleted' });
    } catch (error) {
      logger.error('deleteAlert error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * PUT /api/alerts/:alertId
   * Update threshold or active status
   */
  static async updateAlert(req, res) {
    try {
      const wallet = req.user?.walletAddress?.toLowerCase();
      if (!wallet) return res.status(401).json({ success: false, message: 'Authentication required' });

      const { alertId } = req.params;
      const alert = alertStore.get(alertId);
      if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
      if (alert.userWalletAddress !== wallet) return res.status(403).json({ success: false, message: 'Forbidden' });

      if (req.body.threshold !== undefined) alert.threshold = req.body.threshold;
      if (req.body.active !== undefined) alert.active = Boolean(req.body.active);
      alertStore.set(alertId, alert);
      return res.json({ success: true, data: alert });
    } catch (error) {
      logger.error('updateAlert error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = MarketAlertsController;
