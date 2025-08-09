export function debugEnvironment(req, res) {
  try {
    const envVars = {
      BUBBLE_API_KEY: process.env.BUBBLE_API_KEY ? '✅ Set' : '❌ Missing',
      BUBBLE_APP_NAME: process.env.BUBBLE_APP_NAME || '❌ Missing',
      BUBBLE_BASE_URL: process.env.BUBBLE_BASE_URL || '❌ Missing',
      DATABASE_URL: process.env.DATABASE_URL ? '✅ Set' : '❌ Missing',
      NODE_ENV: process.env.NODE_ENV || 'not set',
      PORT: process.env.PORT || 'not set',
      
      // Show all environment variables that start with BUBBLE
      bubbleVars: Object.keys(process.env)
        .filter(key => key.startsWith('BUBBLE'))
        .reduce((obj, key) => {
          obj[key] = process.env[key] ? '✅ Set' : '❌ Missing';
          return obj;
        }, {})
    };
    
    res.json({
      status: 'debug',
      message: 'Environment variables check',
      environment: envVars,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Debug check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
