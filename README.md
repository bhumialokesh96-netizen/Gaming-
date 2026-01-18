# Multiplayer Skill-Based Gaming Platform

A comprehensive backend system for a multiplayer skill-based gaming platform with peer-to-peer betting, real-time gameplay, and robust fraud detection.

## Features

### 1. Authentication & User Management
- Phone number + OTP authentication
- JWT-based session management
- One-device binding per account
- Device fingerprinting

### 2. Wallet & Ledger System
- Transaction ledger with multiple types (DEPOSIT, BET_LOCK, WIN_CREDIT, COMMISSION, etc.)
- Real-time balance calculations (available, locked, withdrawable)
- Double-spend prevention
- Idempotent transaction processing

### 3. Matchmaking System
- Redis-based matchmaking queues
- Stake-level matching
- Timeout-based cancellations with auto-refunds
- Real-time match status updates

### 4. Real-Time Game Server
- WebSocket-based real-time gameplay
- Server-authoritative game mechanics (dice RNG, move validation)
- Turn enforcement
- Graceful disconnect/reconnect handling
- Game state persistence

### 5. Settlement Engine
- Platform commission calculation and deduction
- Result validation
- Idempotent settlement processing
- Automatic fund distribution

### 6. Anti-Fraud & Risk Management
- Collusion detection
- Emulator and rooted device detection
- Abnormal win ratio tracking
- Multiple account detection
- Automatic wallet locking for suspicious activities

### 7. Admin Panel
- Game configuration management
- Withdrawal approval/rejection
- Live match monitoring
- User account management
- Fraud alert review
- Immutable audit logs

### 8. Compliance & Security
- Responsible gaming limits (daily loss/entry)
- Audit logging for all admin actions
- Input validation and sanitization
- Rate limiting support

## Tech Stack

- **Runtime**: Node.js
- **Framework**: NestJS
- **Database**: PostgreSQL
- **Cache/Queue**: Redis
- **Real-time**: Socket.io
- **Authentication**: JWT, Passport

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v13 or higher)
- Redis (v6 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Gaming-
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=gaming_platform

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d

PORT=3000
NODE_ENV=development
```

4. Set up the database:
```bash
# Create database
createdb gaming_platform

# The application will auto-sync tables in development mode
```

5. Start the application:
```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## API Documentation

### Authentication

#### Send OTP
```http
POST /auth/send-otp
Content-Type: application/json

{
  "phoneNumber": "+1234567890"
}
```

#### Verify OTP and Login
```http
POST /auth/verify-otp
Content-Type: application/json

{
  "phoneNumber": "+1234567890",
  "otp": "123456",
  "deviceId": "unique-device-id"
}
```

Response:
```json
{
  "accessToken": "jwt-token",
  "user": { ... }
}
```

### Wallet

All wallet endpoints require Bearer token authentication.

#### Get Balance
```http
GET /wallet/balance
Authorization: Bearer <token>
```

Response:
```json
{
  "available": 1000,
  "locked": 100,
  "withdrawable": 1000,
  "total": 1100
}
```

#### Deposit
```http
POST /wallet/deposit
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 500,
  "paymentMethod": "UPI",
  "transactionId": "txn_123"
}
```

### Matchmaking

#### Join Matchmaking
```http
POST /matchmaking/join
Authorization: Bearer <token>
Content-Type: application/json

{
  "stakeAmount": 100
}
```

Response:
```json
{
  "status": "searching" | "matched",
  "gameId": "uuid" // if matched
}
```

#### Cancel Matchmaking
```http
DELETE /matchmaking/cancel
Authorization: Bearer <token>
```

### Real-Time Game (WebSocket)

Connect to WebSocket server:
```javascript
const socket = io('http://localhost:3000');

// Join a game
socket.emit('join_game', {
  gameId: 'game-uuid',
  userId: 'user-uuid'
});

// Start game
socket.emit('start_game', {
  gameId: 'game-uuid'
});

// Roll dice
socket.emit('roll_dice', {
  gameId: 'game-uuid',
  userId: 'user-uuid'
});

// Make move
socket.emit('make_move', {
  gameId: 'game-uuid',
  userId: 'user-uuid',
  pieceIndex: 0
});

// Listen for events
socket.on('dice_rolled', (data) => { ... });
socket.on('move_made', (data) => { ... });
socket.on('game_completed', (data) => { ... });
```

### Admin Panel

All admin endpoints require admin authentication.

#### Game Configuration
```http
POST /admin/game-config
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "gameType": "LUDO",
  "stakeLevels": [10, 50, 100, 500, 1000],
  "commissionPercent": 10,
  "rules": {}
}
```

#### Approve Withdrawal
```http
POST /admin/withdrawals/:id/approve
Authorization: Bearer <admin-token>
```

#### Get Live Matches
```http
GET /admin/matches/live
Authorization: Bearer <admin-token>
```

#### Get Fraud Alerts
```http
GET /admin/fraud-alerts?status=FLAGGED
Authorization: Bearer <admin-token>
```

## Architecture

### Database Schema

**Users Table**
- id (UUID, PK)
- phoneNumber (unique)
- deviceId
- role (USER/ADMIN)
- isActive
- isWalletLocked
- dailyLossLimit
- dailyEntryLimit

**Ledger Table**
- id (UUID, PK)
- userId (FK)
- transactionType (enum)
- amount
- balanceAfter
- referenceId
- referenceType
- isReversed
- createdAt

**Games Table**
- id (UUID, PK)
- player1Id, player2Id
- stakeAmount
- commissionAmount
- status (WAITING/IN_PROGRESS/COMPLETED/CANCELLED)
- winnerId
- gameState (JSONB)
- startedAt, completedAt

**Other Tables**: Withdrawals, OTP Verifications, Fraud Alerts, Audit Logs, Game Configs

### Security Considerations

1. **Authentication**: JWT with secure secret keys
2. **Device Binding**: One account per device to prevent multi-accounting
3. **Fraud Detection**: Real-time monitoring and automated wallet locking
4. **Audit Logs**: Immutable logs for compliance and investigation
5. **Input Validation**: All inputs validated using class-validator
6. **Transaction Safety**: Database transactions for critical operations

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Deployment

### Production Checklist

1. Change all secret keys in `.env`
2. Set `NODE_ENV=production`
3. Disable database auto-sync
4. Set up proper database migrations
5. Configure rate limiting
6. Set up monitoring and logging
7. Enable HTTPS
8. Configure firewall rules
9. Set up backup strategies
10. Implement SMS service for OTP (Twilio, AWS SNS, etc.)
11. Integrate payment gateway for deposits
12. Set up error tracking (Sentry, etc.)

### Environment Variables for Production

```env
NODE_ENV=production
DATABASE_HOST=<production-db-host>
JWT_SECRET=<strong-random-secret>
# Add all other production configs
```

## License

MIT

## Support

For support, email support@gamingplatform.com or open an issue in the repository.
