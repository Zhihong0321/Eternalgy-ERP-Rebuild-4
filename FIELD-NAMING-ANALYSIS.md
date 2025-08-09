# FIELD NAMING ANALYSIS

**Generated**: 2025-08-09T09:08:27.456Z
**Purpose**: Re-verify dynamic discovery → Prisma schema generation loop

## 📊 SUMMARY

| Metric | Count | Percentage |
|--------|-------|------------|
| Total Fields | 35 | 100% |
| Valid Fields | 23 | 65.7% |
| Invalid Fields | 12 | 34.3% |
| Edge Cases | 12 | 34.3% |

## 🚨 EDGE CASES THAT BREAK PRISMA RULES

### Fields Starting with Numbers (4)

| Original Field | Current Result | Issues |
|---|---|---|
| `"2nd Payment %"` | `2ndPayment` | Starts with number, Invalid Prisma field name pattern |
| `"1st Payment %"` | `1stPayment` | Starts with number, Invalid Prisma field name pattern |
| `"123 Field"` | `123Field` | Starts with number, Invalid Prisma field name pattern |
| `"123"` | `123` | Starts with number, Invalid Prisma field name pattern |

### Reserved Words (3)

| Original Field | Current Result | Issues |
|---|---|---|
| `"_id"` | `id` | Reserved word in Prisma/SQL |
| `"select"` | `select` | Reserved word in Prisma/SQL |
| `"data"` | `data` | Reserved word in Prisma/SQL |

## 🛠️ FALLBACK STRATEGY

The following strategy should be implemented to handle edge cases:

### 1. Remove non-ASCII characters
Convert accented characters to ASCII equivalents, remove emojis and unicode

**Example**: `"émojis_🚀"` → `emojis`

### 2. Strip invalid characters
Remove all characters except a-z, A-Z, 0-9, and spaces

**Example**: `"field@email.com"` → `fieldemailcom`

### 3. Normalize spaces
Replace multiple spaces with single space, trim edges

**Example**: `"  multiple   spaces  "` → `multiple spaces`

### 4. Convert to camelCase
Split on spaces, lowercase first word, capitalize subsequent words

**Example**: `"Modified Date"` → `modifiedDate`

### 5. Fix numeric start
Prefix with "f" if field name starts with a number

**Example**: `"2nd Payment %"` → `f2ndPayment`

### 6. Handle reserved words
Append "Field" suffix to Prisma/SQL reserved words

**Example**: `"data"` → `dataField`

### 7. Truncate long names
Truncate to 57 chars + 6-char suffix if exceeds PostgreSQL limit

**Example**: `"very long field name..."` → `veryLongFieldName..._abc123`

### 8. Ultimate fallback
Generate random field name if all else fails

**Example**: `"???"` → `field_abc12345`

## 📋 IMPROVED FIELD MAPPINGS

Examples of how problematic fields should be handled:

| Original Field | Current toCamelCase | Improved Result | Issues Resolved |
|---|---|---|---|
| `"_id"` | `id` | `idField` | Reserved word in Prisma/SQL |
| `"2nd Payment %"` | `2ndPayment` | `f2ndPayment` | Starts with number, Invalid Prisma field name pattern |
| `"1st Payment %"` | `1stPayment` | `f1stPayment` | Starts with number, Invalid Prisma field name pattern |
| `"123 Field"` | `123Field` | `f123Field` | Starts with number, Invalid Prisma field name pattern |
| `"select"` | `select` | `selectField` | Reserved word in Prisma/SQL |
| `"data"` | `data` | `dataField` | Reserved word in Prisma/SQL |
| `""` | `` | `field_g1kxzf` | Empty or whitespace-only field name, Invalid Prisma field name pattern |
| `"   "` | `` | `field_1dv5uh` | Empty or whitespace-only field name, Invalid Prisma field name pattern |
| `"中文字段"` | `` | `field_bh0p5l` | Contains non-ASCII characters, Invalid Prisma field name pattern |
| `"émojis_🚀"` | `mojis` | `emojis` | Contains non-ASCII characters |

## ✅ RECOMMENDATIONS

1. **Replace current `toCamelCase()`** with enhanced `toSafePrismaFieldName()` function
2. **Always use `@map("original_field_name")`** to preserve original Bubble field names
3. **Add validation** to catch edge cases during schema generation
4. **Implement fallback logging** to track when fallback names are used
5. **Test with extreme cases** including unicode, very long names, and reserved words

