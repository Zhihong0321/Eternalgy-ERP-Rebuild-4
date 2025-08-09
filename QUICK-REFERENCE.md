# 🚀 ETERNALGY ERP RETRY 3 - QUICK REFERENCE

## Essential URLs
- **Production**: https://postgres-production-8226.up.railway.app
- **Railway Dashboard**: https://railway.com/project/39ddeaf2-0828-4895-8131-a2f0112305e3
- **GitHub Repo**: https://github.com/Zhihong0321/eternalgy-erp-retry3

## Required Environment Variables (Missing ⚠️)
```
BUBBLE_API_KEY=your_bubble_api_key_here
BUBBLE_APP_NAME=eternalgy  
BUBBLE_BASE_URL=https://eternalgy.bubbleapps.io
```

## Test Commands
```powershell
# Health check
Invoke-WebRequest -Uri "https://postgres-production-8226.up.railway.app/health"

# Test API (after env vars set)
Invoke-WebRequest -Uri "https://postgres-production-8226.up.railway.app/api/test/bubble"
```

## Railway Commands
```bash
railway open       # Open dashboard
railway variables  # View env vars
railway logs       # View logs
railway up         # Deploy
```

## Status: Phase 1 Complete ✅
**Next**: Set Bubble API env vars → Test connection → Implement sync engine
