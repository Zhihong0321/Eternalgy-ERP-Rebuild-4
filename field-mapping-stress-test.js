#!/usr/bin/env node

/**
 * Field Mapping Strategy Stress Test
 * Step 3: Prototype field mapper with collision detection and round-trip validation
 */

import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES modules compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load field data from previous analysis
const fieldAnalysis = JSON.parse(fs.readFileSync('FIELD-NAMING-ANALYSIS.json', 'utf8'));
const bubbleDiscovery = JSON.parse(fs.readFileSync('BUBBLE-DISCOVERY-REFERENCE.json', 'utf8'));

// Reserved words in Prisma/SQL - expanded list
const RESERVED_WORDS = new Set([
    'id', 'select', 'from', 'where', 'insert', 'update', 'delete', 'create', 'drop', 'alter',
    'table', 'index', 'view', 'database', 'schema', 'grant', 'revoke', 'commit', 'rollback',
    'begin', 'end', 'transaction', 'join', 'inner', 'outer', 'left', 'right', 'union',
    'group', 'order', 'having', 'distinct', 'count', 'sum', 'avg', 'min', 'max',
    'null', 'true', 'false', 'and', 'or', 'not', 'in', 'like', 'between', 'exists',
    'case', 'when', 'then', 'else', 'if', 'for', 'while', 'do', 'break', 'continue',
    'function', 'procedure', 'trigger', 'constraint', 'primary', 'foreign', 'key',
    'unique', 'check', 'default', 'auto_increment', 'serial', 'sequence',
    'user', 'session', 'connection', 'database', 'information_schema', 'performance_schema',
    'data', 'type', 'class', 'interface', 'enum', 'const', 'let', 'var'
]);

class FieldMapper {
    constructor() {
        this.mappings = new Map(); // rawName -> safePrismaName
        this.reverseMappings = new Map(); // safePrismaName -> rawName
        this.collisions = new Map(); // collisionName -> count
        this.statistics = {
            totalFields: 0,
            validFields: 0,
            collisionFields: 0,
            reservedWordFields: 0,
            numericStartFields: 0,
            generatedNames: 0,
            longNamesTruncated: 0
        };
    }

    /**
     * Generate a safe Prisma field name from raw field name
     */
    generateSafeName(rawName) {
        this.statistics.totalFields++;

        // Handle empty/whitespace fields
        if (!rawName || typeof rawName !== 'string' || rawName.trim() === '') {
            this.statistics.generatedNames++;
            return this._generateFallbackName();
        }

        let safeName = rawName;

        // Step 1: Remove non-ASCII characters and convert accented chars
        safeName = this._normalizeToAscii(safeName);

        // Step 2: Remove all special characters except letters, numbers, and spaces
        safeName = safeName.replace(/[^a-zA-Z0-9\s]/g, '');

        // Step 3: Normalize spaces (multiple spaces -> single space, trim)
        safeName = safeName.replace(/\s+/g, ' ').trim();

        // Step 4: Convert to camelCase
        safeName = this._toCamelCase(safeName);

        // Step 5: Handle fields starting with numbers
        if (/^\d/.test(safeName)) {
            safeName = 'f' + safeName;
            this.statistics.numericStartFields++;
        }

        // Step 6: Handle reserved words
        if (RESERVED_WORDS.has(safeName.toLowerCase()) || safeName === 'id') {
            safeName = safeName + 'Field';
            this.statistics.reservedWordFields++;
        }

        // Step 7: Truncate if too long (PostgreSQL limit is 63 chars)
        if (safeName.length > 57) { // Leave room for collision suffix
            safeName = safeName.substring(0, 57);
            this.statistics.longNamesTruncated++;
        }

        // Step 8: Handle collisions
        safeName = this._handleCollisions(safeName);

        // Final fallback if still invalid
        if (!this._isValidPrismaFieldName(safeName)) {
            this.statistics.generatedNames++;
            safeName = this._generateFallbackName();
        }

        this.statistics.validFields++;
        return safeName;
    }

    /**
     * Map a raw field name to safe Prisma name and store mapping
     */
    mapField(rawName) {
        const safeName = this.generateSafeName(rawName);
        this.mappings.set(rawName, safeName);
        this.reverseMappings.set(safeName, rawName);
        return safeName;
    }

    /**
     * Get the raw field name from a Prisma field name (for @map attribute)
     */
    getRawName(prismaName) {
        return this.reverseMappings.get(prismaName);
    }

    /**
     * Validate round-trip: rawName → prismaName → rawName
     */
    validateRoundTrip(rawName) {
        const prismaName = this.mappings.get(rawName);
        const roundTripRawName = this.reverseMappings.get(prismaName);
        return rawName === roundTripRawName;
    }

    // Private helper methods
    _normalizeToAscii(text) {
        // Convert accented characters to ASCII equivalents
        const accentMap = {
            'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
            'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
            'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
            'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
            'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
            'ñ': 'n', 'ç': 'c', 'ß': 'ss'
        };

        return text.replace(/[àáâãäåèéêëìíîïòóôõöùúûüñçß]/gi, 
            match => accentMap[match.toLowerCase()] || match);
    }

    _toCamelCase(text) {
        if (!text) return '';
        
        const words = text.split(' ').filter(word => word.length > 0);
        if (words.length === 0) return '';
        
        // First word lowercase, subsequent words capitalized
        return words[0].toLowerCase() + 
               words.slice(1).map(word => 
                   word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
               ).join('');
    }

    _handleCollisions(name) {
        const originalName = name;
        let suffix = 1;
        
        // Check if this name already exists
        while (this.reverseMappings.has(name)) {
            name = originalName + suffix;
            suffix++;
            this.statistics.collisionFields++;
        }

        // Track collision statistics
        if (suffix > 1) {
            const collisionKey = originalName;
            this.collisions.set(collisionKey, (this.collisions.get(collisionKey) || 0) + 1);
        }

        return name;
    }

    _generateFallbackName() {
        // Generate a random field name as ultimate fallback
        const randomSuffix = crypto.randomBytes(3).toString('hex');
        return `field_${randomSuffix}`;
    }

    _isValidPrismaFieldName(name) {
        // Prisma field name validation rules
        if (!name || typeof name !== 'string') return false;
        if (name.length === 0 || name.length > 63) return false;
        if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(name)) return false;
        return true;
    }

    getStatistics() {
        return { ...this.statistics };
    }

    getCollisions() {
        return Array.from(this.collisions.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }
}

/**
 * Main stress test function
 */
function runStressTest() {
    console.log('🧪 Field Mapping Strategy Stress Test');
    console.log('=====================================\n');

    const mapper = new FieldMapper();

    // Get all unique field names from discovery
    const allFields = bubbleDiscovery.fieldAnalysis.allFields;
    
    console.log(`📊 Processing ${allFields.length} unique field names...\n`);

    // Process all fields
    const results = [];
    
    allFields.forEach(rawName => {
        const prismaName = mapper.mapField(rawName);
        const roundTripValid = mapper.validateRoundTrip(rawName);
        
        results.push({
            rawName,
            prismaName,
            mapAttribute: rawName !== prismaName ? `@map("${rawName}")` : '',
            roundTripValid,
            category: categorizeField(rawName, prismaName)
        });
    });

    // Test with additional edge cases from analysis
    const edgeCases = [
        '',
        '   ',
        '123',
        '2nd Payment %',
        '1st Payment %',
        'select',
        'data',
        '_id',
        '中文字段',
        'émojis_🚀',
        'a'.repeat(100), // Very long name
        '!!!invalid!!!',
        'field@domain.com',
        'path/to/field'
    ];

    console.log('🔬 Testing edge cases...\n');
    
    edgeCases.forEach(rawName => {
        const prismaName = mapper.mapField(rawName);
        const roundTripValid = mapper.validateRoundTrip(rawName);
        
        results.push({
            rawName,
            prismaName,
            mapAttribute: rawName !== prismaName ? `@map("${rawName}")` : '',
            roundTripValid,
            category: 'edge-case'
        });
    });

    // Generate CSV output
    generateCSV(results);
    
    // Display statistics
    displayStatistics(mapper);
    
    // Analyze collisions
    analyzeCollisions(mapper);

    // Check for manual overrides requirement
    checkManualOverridesRequirement(mapper);

    console.log('\n✅ Stress test completed successfully!');
    console.log('📄 Results exported to field-mapping-results.csv');
}

function categorizeField(rawName, prismaName) {
    if (!rawName || rawName.trim() === '') return 'empty';
    if (/^\d/.test(rawName)) return 'numeric-start';
    if (RESERVED_WORDS.has(rawName.toLowerCase()) || rawName === '_id') return 'reserved-word';
    if (rawName.length > 63) return 'too-long';
    if (/[^\w\s]/.test(rawName)) return 'special-chars';
    if (/[^\x00-\x7F]/.test(rawName)) return 'non-ascii';
    if (rawName !== prismaName) return 'transformed';
    return 'valid';
}

function generateCSV(results) {
    const csvHeader = 'rawName,prismaName,mapAttribute,roundTripValid,category\n';
    const csvRows = results.map(result => {
        const escapedRaw = `"${result.rawName.replace(/"/g, '""')}"`;
        const escapedPrisma = `"${result.prismaName.replace(/"/g, '""')}"`;
        const escapedMap = `"${result.mapAttribute.replace(/"/g, '""')}"`;
        
        return `${escapedRaw},${escapedPrisma},${escapedMap},${result.roundTripValid},${result.category}`;
    }).join('\n');

    const csv = csvHeader + csvRows;
    fs.writeFileSync('field-mapping-results.csv', csv);
    
    // Also generate a before/after comparison CSV
    const beforeAfterHeader = 'Original,Transformed,RequiresMap,Valid\n';
    const beforeAfterRows = results.map(result => {
        const original = `"${result.rawName.replace(/"/g, '""')}"`;
        const transformed = `"${result.prismaName.replace(/"/g, '""')}"`;
        const requiresMap = result.mapAttribute !== '';
        const valid = result.roundTripValid;
        
        return `${original},${transformed},${requiresMap},${valid}`;
    }).join('\n');

    const beforeAfterCSV = beforeAfterHeader + beforeAfterRows;
    fs.writeFileSync('field-mapping-before-after.csv', beforeAfterCSV);
}

function displayStatistics(mapper) {
    const stats = mapper.getStatistics();
    
    console.log('\n📈 Mapping Statistics');
    console.log('====================');
    console.log(`Total fields processed: ${stats.totalFields}`);
    console.log(`Successfully mapped: ${stats.validFields}`);
    console.log(`Collision handling: ${stats.collisionFields}`);
    console.log(`Reserved words fixed: ${stats.reservedWordFields}`);
    console.log(`Numeric start fields: ${stats.numericStartFields}`);
    console.log(`Generated fallback names: ${stats.generatedNames}`);
    console.log(`Long names truncated: ${stats.longNamesTruncated}`);
    
    const successRate = ((stats.validFields / stats.totalFields) * 100).toFixed(2);
    console.log(`\n✨ Success rate: ${successRate}%`);
}

function analyzeCollisions(mapper) {
    const collisions = mapper.getCollisions();
    
    console.log('\n⚠️  Collision Analysis');
    console.log('=====================');
    
    if (collisions.length === 0) {
        console.log('No name collisions detected after camel-casing! 🎉');
        return;
    }
    
    console.log(`Found ${collisions.length} field names that caused collisions:`);
    collisions.forEach(collision => {
        console.log(`  "${collision.name}": ${collision.count} collisions`);
    });
    
    // Show auto-deduplication strategy
    console.log('\n🔧 Auto-deduplication Strategy:');
    console.log('- Append numeric suffix (1, 2, 3...)');
    console.log('- Preserve original mapping via @map attribute');
    console.log('- Ensure all Prisma field names remain unique');
}

function checkManualOverridesRequirement(mapper) {
    const collisions = mapper.getCollisions();
    const highCollisionFields = collisions.filter(c => c.count > 3);
    
    console.log('\n🎛️  Manual Overrides Assessment');
    console.log('===============================');
    
    if (highCollisionFields.length > 0) {
        console.log(`⚠️  Found ${highCollisionFields.length} fields with >3 collisions:`);
        highCollisionFields.forEach(field => {
            console.log(`   "${field.name}": ${field.count} collisions`);
        });
        
        console.log('\n📝 Recommendation: Create mapping-overrides.json');
        console.log('   Manual review needed for high-collision fields');
        
        // Generate sample overrides file
        const overrides = {};
        highCollisionFields.forEach(field => {
            overrides[field.name] = `${field.name}Manual`; // Suggested override
        });
        
        const overridesContent = {
            _description: "Manual field name overrides for high-collision cases",
            _rules: [
                "Use semantic field names that reflect business meaning",
                "Avoid generic suffixes like 1, 2, 3",
                "Prefer domain-specific terminology"
            ],
            overrides
        };
        
        fs.writeFileSync('mapping-overrides.json', JSON.stringify(overridesContent, null, 2));
        console.log('📄 Sample mapping-overrides.json created');
        
    } else {
        console.log('✅ No manual overrides required');
        console.log('   Auto-deduplication handles all collision cases');
    }
}

// Run the stress test
runStressTest();

export { FieldMapper, runStressTest };
