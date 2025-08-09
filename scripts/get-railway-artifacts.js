#!/usr/bin/env node

// Simple script to query Railway artifacts from PostgreSQL
// Usage: railway run node scripts/get-railway-artifacts.js

console.log("SELECT * FROM railway_artifacts ORDER BY timestamp DESC LIMIT 1;");
