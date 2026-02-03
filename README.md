# Sola Terminal Tester

A web application for testing credit card terminals via the CloudIM API. Built for support staff to quickly test and verify terminal connectivity and transaction processing.

## Features

- **Device Registration**: Register new PAX terminals with serial number and friendly name
- **Device Management**: View and select from registered devices, check connection status
- **Transaction Processing**: Initiate various transaction types:
  - Credit Card: Sale, Auth Only, Credit (Refund)
  - Gift Card: Balance, Issue, Redeem, Activate
- **Session Monitoring**: Track session status (Initiating, Processing, Completed, etc.)
- **Result Checking**: Query the Reporting API to get full transaction details
- **Cancel Transactions**: Send cancel requests to abort pending transactions

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Usage

1. **Configure API Key**: Click the settings button in the header and enter your Sola API key (found in Portal > Account Settings > Keys)

2. **Register a Device**: Click "Register" in the Device panel, enter the terminal's serial number and a friendly name

3. **Verify Connection**: Ensure the device shows "CONNECTED" status

4. **Process Transaction**: 
   - Select transaction type
   - Enter amount (if required)
   - Click "Initiate Transaction"
   - The terminal will prompt for card information

5. **Check Results**:
   - Click "Check Session Status" to poll the CloudIM API
   - Once completed, click "Check Transaction Result" to query the Reporting API

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/device` | GET | List registered devices |
| `/api/device` | POST | Register a new device |
| `/api/device/[id]` | GET | Get device status |
| `/api/session` | POST | Initiate a transaction |
| `/api/session/[id]` | GET | Check session status |
| `/api/session/[id]` | DELETE | Cancel a session |
| `/api/report` | POST | Get transaction report |

## Tech Stack

- **Framework**: SvelteKit
- **Styling**: Tailwind CSS
- **APIs**: 
  - CloudIM API (device.cardknox.com)
  - Reporting API (x1.cardknox.com)

## Deployment

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

Can be deployed to Vercel, Netlify, or any Node.js hosting platform.

## Documentation

- [CloudIM Developer Guide](https://docs.solapayments.com/products/cloudim-developer-guide)
- [Reporting API](https://docs.solapayments.com/api/reporting)
- [CloudIM Swagger Docs](https://device.cardknox.com/api/v1/swagger/index.html)
