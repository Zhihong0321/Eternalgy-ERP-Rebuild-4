#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

async function discoverArtifacts() {
    const discovery = {
        timestamp: new Date().toISOString(),
        environment: process.env.RAILWAY_ENVIRONMENT || 'unknown',
        service: process.env.RAILWAY_SERVICE_NAME || 'unknown',
        deployment_id: process.env.RAILWAY_DEPLOYMENT_ID || 'unknown',
        cwd: process.cwd(),
        files: [],
        directories: [],
        environment_vars: {},
        system_info: {}
    };

    try {
        // List all files and directories recursively
        function walkDir(dir, baseDir = dir) {
            try {
                const items = fs.readdirSync(dir);
                
                items.forEach(item => {
                    try {
                        const fullPath = path.join(dir, item);
                        const relativePath = path.relative(baseDir, fullPath);
                        const stat = fs.statSync(fullPath);
                        
                        if (stat.isDirectory()) {
                            discovery.directories.push({
                                path: relativePath,
                                modified: stat.mtime.toISOString()
                            });
                            
                            // Recursively walk subdirectories (limit depth)
                            if (relativePath.split(path.sep).length < 4) {
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
                    } catch (e) {
                        // Skip files/dirs that can't be accessed
                    }
                });
            } catch (e) {
                // Skip directories that can't be accessed
            }
        }
        
        walkDir(process.cwd());
        
        // Get environment variables (filter sensitive ones)
        Object.keys(process.env).forEach(key => {
            if (!key.includes('PASSWORD') && !key.includes('SECRET') && !key.includes('KEY') && !key.includes('TOKEN')) {
                discovery.environment_vars[key] = process.env[key];
            }
        });
        
        // Get system info
        try {
            discovery.system_info.node_version = process.version;
            discovery.system_info.platform = process.platform;
            discovery.system_info.arch = process.arch;
            discovery.system_info.memory = process.memoryUsage();
            
            // Try to get disk usage on linux
            if (process.platform === 'linux') {
                try {
                    discovery.system_info.disk_usage = execSync('df -h .', { encoding: 'utf8' });
                } catch (e) {
                    discovery.system_info.disk_error = e.message;
                }
            }
        } catch (e) {
            discovery.system_info.error = e.message;
        }
        
        console.log('=== RAILWAY ARTIFACT DISCOVERY ===');
        console.log(JSON.stringify(discovery, null, 2));
        console.log('=== END DISCOVERY ===');
        
    } catch (error) {
        console.error('❌ Discovery failed:', error);
        process.exit(1);
    }
}

// Run discovery
discoverArtifacts();
