#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

async function discoverArtifacts() {
    const discovery = {
        timestamp: new Date().toISOString(),
        environment: process.env.RAILWAY_ENVIRONMENT || 'unknown',
        service: process.env.RAILWAY_SERVICE_NAME || 'unknown',
        deployment_id: process.env.RAILWAY_DEPLOYMENT_ID || 'unknown',
        files: [],
        directories: [],
        environment_vars: {},
        system_info: {}
    };

    try {
        // Get current working directory
        discovery.cwd = process.cwd();
        
        // List all files and directories recursively
        function walkDir(dir, baseDir = dir) {
            const items = fs.readdirSync(dir);
            
            items.forEach(item => {
                const fullPath = path.join(dir, item);
                const relativePath = path.relative(baseDir, fullPath);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    discovery.directories.push({
                        path: relativePath,
                        size: 0,
                        modified: stat.mtime.toISOString()
                    });
                    
                    // Recursively walk subdirectories (limit depth to avoid issues)
                    if (relativePath.split(path.sep).length < 5) {
                        walkDir(fullPath, baseDir);
                    }
                } else {
                    discovery.files.push({
                        path: relativePath,
                        size: stat.size,
                        modified: stat.mtime.toISOString(),
                        type: path.extname(item)
                    });
                }
            });
        }
        
        walkDir(process.cwd());
        
        // Get environment variables (filter sensitive ones)
        Object.keys(process.env).forEach(key => {
            if (!key.includes('PASSWORD') && !key.includes('SECRET') && !key.includes('KEY')) {
                discovery.environment_vars[key] = process.env[key];
            }
        });
        
        // Get system info
        try {
            discovery.system_info.node_version = process.version;
            discovery.system_info.platform = process.platform;
            discovery.system_info.arch = process.arch;
            discovery.system_info.memory = process.memoryUsage();
            
            // Try to get disk usage
            if (process.platform === 'linux') {
                discovery.system_info.disk_usage = execSync('df -h .').toString();
            }
        } catch (e) {
            discovery.system_info.error = e.message;
        }
        
        // Save to database
        await saveDiscovery(discovery);
        
        console.log('✅ Discovery completed and saved to database');
        console.log(`Found ${discovery.files.length} files and ${discovery.directories.length} directories`);
        
    } catch (error) {
        console.error('❌ Discovery failed:', error);
        process.exit(1);
    }
}

async function saveDiscovery(discovery) {
    try {
        // Create table if it doesn't exist
        await prisma.$executeRaw`
            CREATE TABLE IF NOT EXISTS railway_artifacts (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMP DEFAULT NOW(),
                environment TEXT,
                service TEXT,
                deployment_id TEXT,
                discovery_data JSONB
            )
        `;
        
        // Insert discovery data
        await prisma.$executeRaw`
            INSERT INTO railway_artifacts (environment, service, deployment_id, discovery_data)
            VALUES (${discovery.environment}, ${discovery.service}, ${discovery.deployment_id}, ${JSON.stringify(discovery)}::jsonb)
        `;
        
        console.log('💾 Discovery saved to PostgreSQL');
        
    } catch (error) {
        console.error('Failed to save discovery:', error);
        throw error;
    }
}

// Run discovery
discoverArtifacts().finally(() => {
    prisma.$disconnect();
});
