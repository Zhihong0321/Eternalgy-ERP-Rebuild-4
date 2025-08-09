#!/usr/bin/env node

/**
 * FIELD NAMING ANALYSIS - Step 2 Task
 * 
 * Purpose: Re-verify dynamic discovery → Prisma schema generation loop
 * 1. Test current toCamelCase conversion against all discovered field patterns
 * 2. Identify edge-cases that break Prisma rules 
 * 3. Draft fallback strategy for invalid field names
 * 4. Generate comprehensive analysis for ADR-006-field-naming.md
 */

import fs from 'fs';

class FieldNamingAnalyzer {
  constructor() {
    this.prismaRules = {
      // Prisma field naming rules
      validPattern: /^[a-zA-Z][a-zA-Z0-9_]*$/,
      reservedWords: new Set([
        'id', 'createdAt', 'updatedAt', 'deletedAt', 'version',
        'where', 'data', 'select', 'include', 'orderBy', 'skip', 'take', 'cursor',
        'distinct', 'connect', 'create', 'update', 'upsert', 'delete', 'disconnect',
        'set', 'push', 'unset', 'increment', 'decrement', 'multiply', 'divide'
      ]),
      invalidStartChars: /^[0-9]/,
      invalidChars: /[^a-zA-Z0-9_]/,
      maxLength: 63 // PostgreSQL column name limit
    };
    
    this.testCases = [
      // Current discovered field patterns
      'Modified Date',
      'check in report today',
      'Profile Picture',
      'Access Level',
      '_id',
      'user_signed_up',
      'Locked Package?',
      '2nd Payment %',
      '1st Payment %',
      'Commission Paid?',
      'Product Warranty (Desc)',
      'TREE SEED',
      
      // Edge cases that might break Prisma rules
      '123 Field',           // Starts with number
      '?status',             // Starts with special char
      '/path/to/field',      // Contains slashes
      'field-name',          // Contains hyphens
      'field@email.com',     // Contains @ and dots
      'field name with many spaces and very long text that exceeds normal limits', // Very long
      '$$price',             // Multiple special chars
      'field\\backslash',    // Contains backslash
      'field"quotes"',       // Contains quotes
      'field[brackets]',     // Contains brackets
      'field{braces}',       // Contains braces
      'field|pipe',          // Contains pipe
      'field+plus',          // Contains plus
      'field=equals',        // Contains equals
      'null',                // SQL reserved word
      'select',              // Prisma reserved word
      'data',                // Prisma reserved word
      '',                    // Empty string
      '   ',                 // Only spaces
      '中文字段',              // Non-ASCII characters
      'émojis_🚀',           // Unicode/emojis
      '123',                 // Only numbers
      'a'.repeat(100),       // Extremely long field name
    ];
    
    this.results = {
      analysis: {
        timestamp: new Date().toISOString(),
        totalFields: 0,
        validFields: 0,
        invalidFields: 0,
        edgeCases: []
      },
      categories: {
        valid: [],
        startsWithNumber: [],
        containsInvalidChars: [],
        reservedWords: [],
        tooLong: [],
        empty: [],
        nonAscii: []
      },
      fallbackStrategy: {
        rules: [],
        examples: []
      }
    };
  }

  /**
   * Current toCamelCase implementation from bubble-data-dictionary.js
   */
  toCamelCase(str) {
    return str
      .replace(/[^a-zA-Z0-9\s]/g, '')  // Remove special chars
      .replace(/\s+/g, ' ')            // Normalize spaces
      .split(' ')
      .map((word, i) => {
        if (i === 0) return word.toLowerCase();
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join('');
  }

  /**
   * Enhanced fallback strategy for invalid field names
   */
  toSafePrismaFieldName(str) {
    if (!str || typeof str !== 'string' || str.trim().length === 0) {
      return 'field_' + Math.random().toString(36).substr(2, 6);
    }

    let safeName = str;
    
    // Step 1: Handle non-ASCII characters - convert to ASCII or remove
    safeName = safeName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^\x00-\x7F]/g, '');   // Remove non-ASCII
    
    // Step 2: Remove or replace invalid characters
    safeName = safeName
      .replace(/[^a-zA-Z0-9\s]/g, '')  // Remove special chars
      .replace(/\s+/g, ' ')            // Normalize spaces
      .trim();
    
    // Step 3: Handle empty after cleaning
    if (!safeName) {
      return 'field_' + Math.random().toString(36).substr(2, 6);
    }
    
    // Step 4: Convert to camelCase
    safeName = safeName
      .split(' ')
      .map((word, i) => {
        if (i === 0) return word.toLowerCase();
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join('');
    
    // Step 5: Handle starts with number
    if (this.prismaRules.invalidStartChars.test(safeName)) {
      safeName = 'f' + safeName; // Prefix with 'f'
    }
    
    // Step 6: Handle reserved words
    if (this.prismaRules.reservedWords.has(safeName.toLowerCase())) {
      safeName = safeName + 'Field';
    }
    
    // Step 7: Handle too long names
    if (safeName.length > this.prismaRules.maxLength) {
      safeName = safeName.substring(0, this.prismaRules.maxLength - 6) + 
                 '_' + Math.random().toString(36).substr(2, 5);
    }
    
    // Step 8: Final validation - if still invalid, use fallback
    if (!this.prismaRules.validPattern.test(safeName)) {
      safeName = 'field_' + Math.random().toString(36).substr(2, 8);
    }
    
    return safeName;
  }

  /**
   * Analyze a field name against Prisma rules
   */
  analyzeFieldName(originalField) {
    const camelCaseField = this.toCamelCase(originalField);
    const safePrismaField = this.toSafePrismaFieldName(originalField);
    
    const analysis = {
      original: originalField,
      camelCase: camelCaseField,
      safePrisma: safePrismaField,
      issues: [],
      category: 'valid'
    };

    // Check for various issues
    if (!originalField || originalField.trim().length === 0) {
      analysis.issues.push('Empty or whitespace-only field name');
      analysis.category = 'empty';
    }
    
    if (this.prismaRules.invalidStartChars.test(camelCaseField)) {
      analysis.issues.push('Starts with number');
      analysis.category = 'startsWithNumber';
    }
    
    if (this.prismaRules.invalidChars.test(camelCaseField)) {
      analysis.issues.push('Contains invalid characters');
      analysis.category = 'containsInvalidChars';
    }
    
    if (this.prismaRules.reservedWords.has(camelCaseField.toLowerCase())) {
      analysis.issues.push('Reserved word in Prisma/SQL');
      analysis.category = 'reservedWords';
    }
    
    if (camelCaseField.length > this.prismaRules.maxLength) {
      analysis.issues.push(`Too long (${camelCaseField.length} > ${this.prismaRules.maxLength})`);
      analysis.category = 'tooLong';
    }
    
    if (!/^[\x00-\x7F]*$/.test(originalField)) {
      analysis.issues.push('Contains non-ASCII characters');
      analysis.category = 'nonAscii';
    }
    
    // Final validation
    if (!this.prismaRules.validPattern.test(camelCaseField)) {
      analysis.issues.push('Invalid Prisma field name pattern');
    }
    
    analysis.isValid = analysis.issues.length === 0;
    
    return analysis;
  }

  /**
   * Run comprehensive analysis on all test cases and discovered fields
   */
  async runAnalysis() {
    console.log('🔍 Starting Field Naming Analysis...\n');

    // Load discovered fields from existing data
    const discoveredFields = await this.loadDiscoveredFields();
    
    // Combine discovered fields with test cases
    const allFields = [...new Set([...discoveredFields, ...this.testCases])];
    
    console.log(`📊 Analyzing ${allFields.length} field names...\n`);

    // Analyze each field
    for (const field of allFields) {
      const analysis = this.analyzeFieldName(field);
      
      // Categorize results
      this.results.categories[analysis.category].push(analysis);
      
      if (!analysis.isValid) {
        this.results.analysis.invalidFields++;
        this.results.analysis.edgeCases.push(analysis);
      } else {
        this.results.analysis.validFields++;
      }
    }

    this.results.analysis.totalFields = allFields.length;

    // Generate fallback strategy documentation
    this.generateFallbackStrategy();

    console.log('✅ Analysis complete!\n');
    console.log(`📈 Results:`);
    console.log(`   Total fields: ${this.results.analysis.totalFields}`);
    console.log(`   Valid fields: ${this.results.analysis.validFields}`);
    console.log(`   Invalid fields: ${this.results.analysis.invalidFields}`);
    console.log(`   Edge cases found: ${this.results.analysis.edgeCases.length}\n`);

    // Save results
    await this.saveResults();
    
    return this.results;
  }

  /**
   * Load discovered fields from existing analysis
   */
  async loadDiscoveredFields() {
    try {
      const discoveryData = JSON.parse(fs.readFileSync('./BUBBLE-DISCOVERY-REFERENCE.json', 'utf8'));
      return discoveryData.fieldAnalysis?.allFields || [];
    } catch (error) {
      console.log('⚠️  Could not load existing discovery data, using test cases only');
      return [];
    }
  }

  /**
   * Generate fallback strategy rules and examples
   */
  generateFallbackStrategy() {
    this.results.fallbackStrategy.rules = [
      {
        rule: 'Remove non-ASCII characters',
        description: 'Convert accented characters to ASCII equivalents, remove emojis and unicode',
        example: { input: 'émojis_🚀', output: 'emojis' }
      },
      {
        rule: 'Strip invalid characters',
        description: 'Remove all characters except a-z, A-Z, 0-9, and spaces',
        example: { input: 'field@email.com', output: 'fieldemailcom' }
      },
      {
        rule: 'Normalize spaces',
        description: 'Replace multiple spaces with single space, trim edges',
        example: { input: '  multiple   spaces  ', output: 'multiple spaces' }
      },
      {
        rule: 'Convert to camelCase',
        description: 'Split on spaces, lowercase first word, capitalize subsequent words',
        example: { input: 'Modified Date', output: 'modifiedDate' }
      },
      {
        rule: 'Fix numeric start',
        description: 'Prefix with "f" if field name starts with a number',
        example: { input: '2nd Payment %', output: 'f2ndPayment' }
      },
      {
        rule: 'Handle reserved words',
        description: 'Append "Field" suffix to Prisma/SQL reserved words',
        example: { input: 'data', output: 'dataField' }
      },
      {
        rule: 'Truncate long names',
        description: 'Truncate to 57 chars + 6-char suffix if exceeds PostgreSQL limit',
        example: { input: 'very long field name...', output: 'veryLongFieldName..._abc123' }
      },
      {
        rule: 'Ultimate fallback',
        description: 'Generate random field name if all else fails',
        example: { input: '???', output: 'field_abc12345' }
      }
    ];

    // Add concrete examples from analysis
    this.results.fallbackStrategy.examples = this.results.analysis.edgeCases
      .slice(0, 10) // Top 10 examples
      .map(analysis => ({
        original: analysis.original,
        currentResult: analysis.camelCase,
        improvedResult: analysis.safePrisma,
        issues: analysis.issues
      }));
  }

  /**
   * Save analysis results
   */
  async saveResults() {
    const resultsFile = './FIELD-NAMING-ANALYSIS.json';
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    
    // Generate markdown report
    const markdownReport = this.generateMarkdownReport();
    fs.writeFileSync('./FIELD-NAMING-ANALYSIS.md', markdownReport);
    
    console.log(`📄 Results saved to:`);
    console.log(`   - ${resultsFile}`);
    console.log(`   - FIELD-NAMING-ANALYSIS.md`);
  }

  /**
   * Generate markdown analysis report
   */
  generateMarkdownReport() {
    let md = `# FIELD NAMING ANALYSIS\n\n`;
    md += `**Generated**: ${this.results.analysis.timestamp}\n`;
    md += `**Purpose**: Re-verify dynamic discovery → Prisma schema generation loop\n\n`;

    md += `## 📊 SUMMARY\n\n`;
    md += `| Metric | Count | Percentage |\n`;
    md += `|--------|-------|------------|\n`;
    md += `| Total Fields | ${this.results.analysis.totalFields} | 100% |\n`;
    md += `| Valid Fields | ${this.results.analysis.validFields} | ${((this.results.analysis.validFields / this.results.analysis.totalFields) * 100).toFixed(1)}% |\n`;
    md += `| Invalid Fields | ${this.results.analysis.invalidFields} | ${((this.results.analysis.invalidFields / this.results.analysis.totalFields) * 100).toFixed(1)}% |\n`;
    md += `| Edge Cases | ${this.results.analysis.edgeCases.length} | ${((this.results.analysis.edgeCases.length / this.results.analysis.totalFields) * 100).toFixed(1)}% |\n\n`;

    md += `## 🚨 EDGE CASES THAT BREAK PRISMA RULES\n\n`;
    
    if (this.results.categories.startsWithNumber.length > 0) {
      md += `### Fields Starting with Numbers (${this.results.categories.startsWithNumber.length})\n\n`;
      md += `| Original Field | Current Result | Issues |\n|---|---|---|\n`;
      this.results.categories.startsWithNumber.slice(0, 5).forEach(item => {
        md += `| \`"${item.original}"\` | \`${item.camelCase}\` | ${item.issues.join(', ')} |\n`;
      });
      md += `\n`;
    }

    if (this.results.categories.containsInvalidChars.length > 0) {
      md += `### Fields with Invalid Characters (${this.results.categories.containsInvalidChars.length})\n\n`;
      md += `| Original Field | Current Result | Issues |\n|---|---|---|\n`;
      this.results.categories.containsInvalidChars.slice(0, 5).forEach(item => {
        md += `| \`"${item.original}"\` | \`${item.camelCase}\` | ${item.issues.join(', ')} |\n`;
      });
      md += `\n`;
    }

    if (this.results.categories.reservedWords.length > 0) {
      md += `### Reserved Words (${this.results.categories.reservedWords.length})\n\n`;
      md += `| Original Field | Current Result | Issues |\n|---|---|---|\n`;
      this.results.categories.reservedWords.forEach(item => {
        md += `| \`"${item.original}"\` | \`${item.camelCase}\` | ${item.issues.join(', ')} |\n`;
      });
      md += `\n`;
    }

    md += `## 🛠️ FALLBACK STRATEGY\n\n`;
    md += `The following strategy should be implemented to handle edge cases:\n\n`;

    this.results.fallbackStrategy.rules.forEach((rule, index) => {
      md += `### ${index + 1}. ${rule.rule}\n`;
      md += `${rule.description}\n\n`;
      md += `**Example**: \`"${rule.example.input}"\` → \`${rule.example.output}\`\n\n`;
    });

    md += `## 📋 IMPROVED FIELD MAPPINGS\n\n`;
    md += `Examples of how problematic fields should be handled:\n\n`;
    md += `| Original Field | Current toCamelCase | Improved Result | Issues Resolved |\n`;
    md += `|---|---|---|---|\n`;
    
    this.results.fallbackStrategy.examples.forEach(example => {
      md += `| \`"${example.original}"\` | \`${example.currentResult}\` | \`${example.improvedResult}\` | ${example.issues.join(', ')} |\n`;
    });

    md += `\n## ✅ RECOMMENDATIONS\n\n`;
    md += `1. **Replace current \`toCamelCase()\`** with enhanced \`toSafePrismaFieldName()\` function\n`;
    md += `2. **Always use \`@map("original_field_name")\`** to preserve original Bubble field names\n`;
    md += `3. **Add validation** to catch edge cases during schema generation\n`;
    md += `4. **Implement fallback logging** to track when fallback names are used\n`;
    md += `5. **Test with extreme cases** including unicode, very long names, and reserved words\n\n`;

    return md;
  }
}

// Run analysis if called directly
const currentFile = process.argv[1].replace(/\\/g, '/');
const importUrl = import.meta.url.replace(/\\/g, '/');

if (importUrl.includes(currentFile) || process.argv[1].includes('field-naming-analysis')) {
  console.log('🚀 Initializing Field Naming Analyzer...');
  const analyzer = new FieldNamingAnalyzer();
  analyzer.runAnalysis().catch(console.error);
}

export { FieldNamingAnalyzer };
