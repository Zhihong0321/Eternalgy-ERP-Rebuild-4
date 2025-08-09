# Eternalgy ERP Retry 3

Bubble.io to PostgreSQL sync system with 100% reliability.

## Architecture

- **Backend**: Node.js + Express
- **Database**: PostgreSQL (Railway)
- **ORM**: Prisma
- **Hosting**: Railway.app

## Environment Variables

Required in Railway deployment:

```bash
BUBBLE_API_KEY=your_bubble_api_key_here
BUBBLE_APP_NAME=eternalgy
BUBBLE_BASE_URL=https://eternalgy.bubbleapps.io
DATABASE_URL=postgresql://... (provided by Railway)
NODE_ENV=production
PORT=3000
```

## API Endpoints

### Test Endpoints
- `GET /health` - Health check
- `GET /api/test/bubble` - Test Bubble API connection
- `GET /api/test/discover-tables` - Discover all Bubble data types
- `GET /api/test/sample-data?table={name}&limit={num}` - Get sample data

### Deployment

1. Push to GitHub repository
2. Railway automatically builds and deploys
3. Test endpoints via Railway URL

## Development Rules

- ✅ Railway-first deployment
- ✅ No local testing
- ✅ Use existing BubbleService
- ✅ Simple field mapping via Prisma @map()
- ❌ No custom field mapping services
- ❌ No localhost development
