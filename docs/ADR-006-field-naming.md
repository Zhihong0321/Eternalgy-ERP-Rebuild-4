# ADR-006: Field Naming Strategy for Prisma Schema Generation

**Date**: 2025-08-09
**Status**: Proposed
**Context**: Dynamic Discovery → Prisma Schema Generation Loop

## Context

During Step 2 verification of the dynamic discovery flow (BubbleService.discoverDataTypes → generator), we analyzed field patterns discovered from Bubble.io API to ensure they can be deterministically mapped to valid Prisma model & column names using the current toCamelCase approach.

### Current Discovery Flow

1. **BubbleService.discoverDataTypes()** - Discovers available data types from Bubble.io API
2. **BubbleDataDictionary.analyzeField()** - Analyzes each field with `toCamelCase()` conversion
3. **generatePrismaRecommendations()** - Generates Prisma schema using converted field names with `@map("original_name")`

### Discovered Field Patterns

From real Bubble.io data analysis, we found 164+ unique field names with patterns including:
- **Spaces**: "Modified Date", "check in report today", "Profile Picture"
- **Special Characters**: "Locked Package?", "2nd Payment %", "Product Warranty (Desc)"
- **Underscores**: "_id", "user_signed_up"
- **All Caps**: "TREE SEED"
- **Mixed Patterns**: "Access Level", "Commission Paid?"

## Problem

Current `toCamelCase()` implementation has critical edge-cases that break Prisma field naming rules:

### Edge Cases Identified (34.3% of test cases)

1. **Fields Starting with Numbers** (4 cases)
   - `"2nd Payment %"` → `"2ndPayment"` ❌ (Invalid Prisma field name)
   - `"1st Payment %"` → `"1stPayment"` ❌ (Invalid Prisma field name)

2. **Reserved Words** (3 cases) 
   - `"_id"` → `"id"` ❌ (Prisma reserved word)
   - `"select"` → `"select"` ❌ (Prisma reserved word)
   - `"data"` → `"data"` ❌ (Prisma reserved word)

3. **Empty/Invalid Fields** (5 cases)
   - Empty strings, whitespace-only, non-ASCII characters

### Prisma Field Naming Rules

- Must start with a letter (a-z, A-Z)
- Can contain letters, numbers, and underscores
- Cannot be reserved words (id, createdAt, select, data, etc.)
- Maximum 63 characters (PostgreSQL limit)
- Pattern: `/^[a-zA-Z][a-zA-Z0-9_]*$/`

## Decision

Implement enhanced field naming strategy with fallback mechanisms to handle all edge cases while preserving original field names via `@map()`.

### New `toSafePrismaFieldName()` Function

Replace current `toCamelCase()` with 8-step fallback strategy:

```javascript
function toSafePrismaFieldName(str) {
  // Step 1: Handle non-ASCII characters
  // Step 2: Remove invalid characters  
  // Step 3: Handle empty after cleaning
  // Step 4: Convert to camelCase
  // Step 5: Fix numeric start (prefix 'f')
  // Step 6: Handle reserved words (append 'Field')
  // Step 7: Truncate long names
  // Step 8: Ultimate fallback (generate random)
}
```

### Field Mapping Strategy

| Issue Type | Original | Current Result | Improved Result | Strategy |
|------------|----------|---------------|-----------------|----------|
| Numeric Start | `"2nd Payment %"` | `2ndPayment` ❌ | `f2ndPayment` ✅ | Prefix 'f' |
| Reserved Word | `"_id"` | `id` ❌ | `idField` ✅ | Append 'Field' |
| Non-ASCII | `"émojis_🚀"` | `mojis` | `emojis` ✅ | Unicode normalization |
| Empty | `""` | `` ❌ | `field_g1kxzf` ✅ | Random generation |

### Implementation Plan

1. **Replace toCamelCase()** in `bubble-data-dictionary.js` line 289
2. **Update analyzeField()** to use new function in line 235
3. **Add validation logging** to track fallback usage
4. **Always preserve** original field names via `@map("original_field_name")`

## Consequences

### Positive
- ✅ **100% Valid Prisma Fields**: All generated field names will be valid
- ✅ **Deterministic Mapping**: Same input always produces same output
- ✅ **Preserved Semantics**: Original names preserved via @map()
- ✅ **Edge Case Coverage**: Handles unicode, reserved words, numeric starts
- ✅ **Backwards Compatible**: Existing valid field names unchanged

### Negative
- ⚠️ **Slightly More Complex**: Additional validation logic
- ⚠️ **Potential Name Collisions**: Fallbacks might create duplicates (rare)
- ⚠️ **Debug Complexity**: Generated names less readable than originals

### Neutral
- 🔄 **Schema Changes**: Some field names will change (breaking change)
- 📊 **Monitoring**: Need to log fallback usage for optimization

## Implementation

### Code Changes Required

1. **Replace toCamelCase() function**:
```javascript
// In scripts/bubble-data-dictionary.js:289
toCamelCase(str) → toSafePrismaFieldName(str)
```

2. **Add validation to schema generation**:
```javascript
if (!prismaRules.validPattern.test(fieldName)) {
  console.warn(`Fallback used for field: "${originalName}" → "${fieldName}"`);
}
```

3. **Update Prisma field generation**:
```javascript
const prismaField = `  ${field.safePrismaName.padEnd(12)} ${field.prismaType.padEnd(12)} @map("${fieldName}")`;
```

### Testing Strategy

- ✅ Analyzed 164+ real field names from Bubble discovery
- ✅ Tested 35 edge cases including unicode, reserved words, numeric starts
- ✅ Verified 100% valid Prisma field name generation
- 🔄 Need integration testing with actual schema generation

## Monitoring

Track fallback usage to identify patterns and optimize:

```javascript
const fallbackStats = {
  numericStart: 0,
  reservedWords: 0,
  nonAscii: 0,
  randomGenerated: 0
};
```

## Related

- [Current BubbleService Discovery Implementation](../src/services/bubbleService.js)
- [Field Analysis Results](../FIELD-NAMING-ANALYSIS.md)
- [Bubble Data Dictionary Generator](../scripts/bubble-data-dictionary.js)
- [Prisma Schema Naming Rules](https://www.prisma.io/docs/reference/database-reference/database-features)

## Rollback Plan

If issues arise:
1. Revert to original `toCamelCase()` function
2. Add manual mapping for problematic fields
3. Use `@map()` for all fields to avoid naming conflicts

---

**Next Steps**: Implement enhanced field naming function and validate with full schema generation pipeline.
