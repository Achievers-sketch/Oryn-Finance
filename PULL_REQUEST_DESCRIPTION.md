# Pull Request: Multi-Timezone Event Scheduling, Whale Activity Monitoring, Market Resolution Appeals, and Mobile Trading

**Closes:** #166 #169 #168 #167

## Overview
This PR implements four major features for the Oryn Finance prediction market platform:

1. **Multi-Timezone Event Scheduling (#166)** - Global users now get localized market timing
2. **Whale Activity Monitoring (#169)** - Track and alert on large trades that impact markets
3. **Advanced Mobile Trading Mode (#168)** - Optimized mobile interface with quick trading and gestures
4. **Market Resolution Appeals Workflow (#167)** - Structured dispute mechanism for market resolutions

## Changes Summary

### Backend Models
- **EventSchedule.js** - Stores market events with localized times for different timezones
- **WhaleTransaction.js** - Records large transactions with impact metrics
- **WhaleAlert.js** - Alerts generated from whale transaction detection
- **Appeal.js** - Market resolution appeals with review process tracking

### Backend Services
- **timezoneService.js** - Timezone conversions, countdown calculations, user preferences
- **whaleMonitoringService.js** - Whale transaction detection and alert generation
- **mobileTradingService.js** - Mobile trading configuration and validation
- **appealService.js** - Appeal submission, review voting, and resolution

### Backend Routes
- `/api/timezones` - Timezone management and event scheduling
- `/api/whale-activity` - Whale activity feed and alerts
- `/api/mobile-trading` - Mobile trading preferences and configuration
- `/api/appeals` - Appeal submission, review, and voting

### Frontend Components
- **TimezoneSettings.tsx** - User timezone configuration with countdown display
- **WhaleActivityFeed.tsx** - Real-time whale activity feed with severity indicators
- **MarketResolutionAppeal.tsx** - Appeal submission form with evidence tracking
- **QuickTradePanel.tsx** - Fast mobile trading with presets and sliders
- **MobileChartLayout.tsx** - Optimized price charts for mobile with zoom controls

### Frontend Hooks
- **useMobileGestures.ts** - Swipe, pinch, tap gestures for mobile trading

### User Model Updates
- `preferences.localization` - Timezone, language, date/time format preferences
- `preferences.mobileTrading` - Mobile trading mode settings
- `preferences.whaleAlerts` - Whale alert notification preferences
- `preferences.appealNotifications` - Appeal-related notification settings

## Features

### #166 Multi-Timezone Event Scheduling
**Tasks Completed:**
- ✅ Convert event times to multiple timezones
- ✅ User timezone settings with language and date format options
- ✅ Localized countdowns that update in real-time

**API Endpoints:**
```
GET    /api/timezones/all                      # Get all available timezones
GET    /api/timezones/user                     # Get user's timezone
POST   /api/timezones/convert                  # Convert UTC to multiple TZs
GET    /api/timezones/countdown/:marketId      # Get countdown in user TZ
POST   /api/timezones/event-schedule           # Create/update event schedule
GET    /api/timezones/event-schedule/:marketId # Get event schedule
GET    /api/timezones/format                   # Format datetime for user
GET    /api/timezones/is-coming-up/:marketId   # Check if event is upcoming
```

**User Experience:**
- Markets show times in local timezone automatically
- Countdowns update every second with days/hours/minutes/seconds
- Notifications trigger at specified intervals before market events
- Support for 12-hour and 24-hour time formats

### #169 Whale Activity Monitoring
**Tasks Completed:**
- ✅ Detect whale transactions based on volume percentage
- ✅ Generate severity-based alerts (low/medium/high/critical)
- ✅ Show whale activity feed with profiles

**API Endpoints:**
```
GET    /api/whale-activity/feed                # Get whale activity feed
GET    /api/whale-activity/profile/:wallet     # Get whale wallet profile
GET    /api/whale-activity/alerts/:marketId    # Get alerts for market
POST   /api/whale-activity/dismiss/:alertId    # Dismiss alert
GET    /api/whale-activity/alert/:alertId      # Get alert details
POST   /api/whale-activity/detect              # Manually detect whale tx
GET    /api/whale-activity/stats               # Get activity statistics
```

**Detection Criteria:**
- Minimum trade volume: $10,000
- Large trade threshold: 5% of market volume
- Price impact calculation based on volume
- Wallet history analysis for new/established accounts

**Alert Severity:**
- Critical: >15% market volume
- High: >10% market volume
- Medium: >7% market volume
- Low: >5% market volume

### #168 Advanced Mobile Trading Mode
**Tasks Completed:**
- ✅ Quick trade panel with preset amounts
- ✅ Optimized chart layouts for mobile screens
- ✅ Swipe and gesture interactions

**API Endpoints:**
```
GET    /api/mobile-trading/preferences         # Get mobile settings
PUT    /api/mobile-trading/preferences         # Update settings
POST   /api/mobile-trading/enable              # Enable mobile mode
POST   /api/mobile-trading/disable             # Disable mobile mode
GET    /api/mobile-trading/chart-config        # Get chart configuration
GET    /api/mobile-trading/quick-trade-config  # Get quick trade settings
GET    /api/mobile-trading/gestures            # Get gesture setup
POST   /api/mobile-trading/validate-trade      # Validate trade
GET    /api/mobile-trading/analytics           # Get trading analytics
POST   /api/mobile-trading/update-order-size   # Update quick trade size
```

**Gesture Controls:**
- Swipe left/right - Navigate between markets
- Swipe up - Open quick trade panel
- Swipe down - Close quick trade panel
- Long press - Quick buy
- Double tap - Quick sell
- Pinch in/out - Zoom chart

**Features:**
- Quick trade panel with preset sizes (Small/Medium/Large)
- Order size slider for custom amounts
- One-click trading option
- Simplified chart with 50-200 candles
- Reduced data point updates for performance
- Compact layout on mobile screens

### #167 Market Resolution Appeals Workflow
**Tasks Completed:**
- ✅ Appeal submission with evidence
- ✅ Community reviewer voting process
- ✅ Resolution tracking and history

**API Endpoints:**
```
POST   /api/appeals                            # Submit appeal
GET    /api/appeals/:appealId                  # Get appeal details
GET    /api/appeals                            # Get appeals (filtered)
POST   /api/appeals/:appealId/assign-reviewers # Assign reviewers
POST   /api/appeals/:appealId/vote             # Submit review vote
POST   /api/appeals/:appealId/finalize         # Finalize resolution
GET    /api/appeals/market/:marketId           # Get market appeals
GET    /api/appeals/user/:userAddress          # Get user appeals
```

**Appeal Reasons:**
- Resolution criteria not met
- Oracle error/malfunction
- Subjective interpretation dispute
- New evidence available
- Other

**Review Process:**
- 7-day voting period
- Multiple community reviewers assigned
- Majority vote determines outcome
- Full audit trail of all votes and reasoning
- Automatic market resolution update if appeal approved

**Evidence Types:**
- Links/URLs to external sources
- Document uploads
- Screenshots
- News articles
- Other supporting materials

## Testing Recommendations

### Unit Tests
```bash
# Test timezone conversions
npm test -- timezoneService.test.ts

# Test whale detection
npm test -- whaleMonitoringService.test.ts

# Test appeal workflow
npm test -- appealService.test.ts

# Test mobile trading validation
npm test -- mobileTradingService.test.ts
```

### Integration Tests
```bash
# Test timezone API endpoints
curl http://localhost:5001/api/timezones/all

# Test whale activity detection
curl -X POST http://localhost:5001/api/whale-activity/detect

# Test appeal submission
curl -X POST http://localhost:5001/api/appeals \
  -H "Authorization: Bearer TOKEN" \
  -d '{"marketId": "...", "reason": "...", ...}'

# Test mobile trading preferences
curl -X GET http://localhost:5001/api/mobile-trading/preferences \
  -H "Authorization: Bearer TOKEN"
```

### Frontend Testing
1. Timezone Settings - Verify timezone selection updates all market times
2. Whale Activity - Check alert feed updates in real-time
3. Mobile Trading - Test gesture recognition on mobile device
4. Appeals - Submit appeal and verify review process UI

## Performance Considerations

- **EventSchedule**: Indexed on marketId and eventType for fast lookups
- **WhaleTransaction**: Indexed on timestamp and wallet for historical queries
- **WhaleAlert**: Indexed on severity for quick alert filtering
- **Appeal**: Indexed on status and marketId for filtering operations
- **Canvas Chart**: Limited to 200 candles max for mobile performance
- **WebSocket**: Real-time updates for whale alerts and countdowns

## Security Considerations

- Appeal voting only by assigned reviewers
- Whale alert dismissal tracked with actor and reason
- Market resolution update only after consensus
- Rate limiting on alert generation to prevent spam
- Input validation on all user-provided data

## Database Migrations

If using MongoDB, these collections will be auto-created:
- `eventschedules`
- `whaletransa ctions`
- `whalealerts`
- `appeals`

User model updated with new preference fields (non-breaking change).

## Deployment Notes

1. **Environment Variables:**
   - No new environment variables required
   - Existing Redis/MongoDB configuration used

2. **Data Migration:**
   - No migration needed - backwards compatible
   - User preferences auto-populated with defaults

3. **API Version:**
   - No breaking changes to existing endpoints
   - New endpoints are additive

4. **Frontend Dependencies:**
   - moment-timezone (added for timezone support)
   - No breaking changes to existing dependencies

## Future Enhancements

1. **Whale Monitoring:**
   - Machine learning model for whale behavior prediction
   - Customizable whale detection thresholds
   - Whale wallet labeling and tracking

2. **Appeals:**
   - Automated appeal categorization
   - Appeal insurance pool
   - Multi-stage appeal process

3. **Mobile Trading:**
   - Offline trade queuing
   - Biometric authentication
   - Voice commands

4. **Timezone:**
   - Market-specific holiday calendars
   - Trading session constraints by timezone
   - Automatic DST handling

## Contributors
- Implementation of all four features
- Comprehensive service layer abstraction
- React components with TypeScript
- API documentation and examples

---

**Related Issues:**
- Closes #166 - Multi-Timezone Event Scheduling
- Closes #169 - Whale Activity Monitoring
- Closes #168 - Advanced Mobile Trading Mode
- Closes #167 - Market Resolution Appeals Workflow
