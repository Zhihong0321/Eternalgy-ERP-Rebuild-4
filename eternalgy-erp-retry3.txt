```markdown
# BUBBLE → ERP 2.0 SYNC ARCHITECTURE DOCUMENT  
**FOR AI CODING AGENT**  
`ai-playbook-sync-core.md`  
**DO NOT MODIFY** — This is the single source of truth for sync logic.

---

## 🎯 GOAL  
Mirror Bubble.io data → PostgreSQL via Prisma with 100% reliability.  
Bubble = Source of Truth.  
Unidirectional sync only.  
Railway-first. No local execution.

---

## 🔑 CORE RULES (NON-NEGOTIABLE)  
- ✅ Use `BubbleService` for all API calls  
- ✅ Discover data types dynamically — **NO HARDCODED TABLES**  
- ✅ Generate Prisma schema using `@map("Original Bubble Field")`  
- ✅ Use `toCamelCase()` for Prisma field names  
- ✅ Apply schema via `prisma db push`  
- ✅ Sync via `prisma.[model].upsert()`  
- ✅ Soft delete: `isDeleted = true`  
- ✅ Overwrite local on conflict  
- ✅ One table at a time — no parallel sync  
- ✅ All testing on Railway — **NO LOCAL TESTING**  
- ✅ Fail fast — stop sync on first error  
- ❌ NO `simpleFieldMapping.js` or any field mapping service  
- ❌ NO middleware between Bubble and Prisma  
- ❌ NO field name hashing, collision detection, or custom transforms  
- ❌ NO JSONB dumps — use structured schema  
- ❌ NO rate limit retries — let sync resume manually  

---

## 🧩 TECH STACK (EXACT)  
| Layer | Technology |  
|------|------------|  
| Backend | Node.js + Express |  
| ORM | Prisma |  
| Database | PostgreSQL (Railway) |  
| HTTP Client | Axios |  
| Build Tool | pnpm |  
| Hosting | Railway.app |  
| AI IDE | Warp 2.0 |  

---

## 📂 FOLDER STRUCTURE (MUST FOLLOW)  
```
eternalgy-erp/  
├── src/  
│   ├── api/  
│   │   ├── test/              → Test endpoints (AI self-validation)  
│   │   ├── sync/              → Sync control: start, stop, status  
│   │   └── logs/              → Log retrieval  
│   ├── services/  
│   │   ├── bubbleService.js   → Reuse — DO NOT MODIFY  
│   │   └── bubbleSyncService.js → ONLY NEW FILE — ALL SYNC LOGIC HERE  
│   └── server.js  
├── prisma/  
│   └── schema.prisma          → Generated dynamically  
├── samples/                   → Store sample API responses  
├── scripts/  
│   └── discover-bubble-api.ts → Run once: save samples  
├── ai-playbook-sync-core.md   → This file  
└── .env  
```

---

## 🔄 SYNC WORKFLOW (LINEAR, ONE PATH)  
1. `GET /api/test/discover-tables` → returns list of Bubble data types  
2. `POST /api/admin/sync-schema` → generates Prisma schema → `prisma db push`  
3. `POST /api/admin/sync-data` → syncs each table one-by-one  
4. `GET /api/sync/status` → returns progress, current table, error if any  
5. `POST /api/admin/cancel-sync` → sets `syncRunning = false`  

---

## 🛠️ FIELD NAMING STRATEGY (AUTOMATIC)  
Use this function for all field name conversions:  

```ts
function toCamelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9\s]/g, '')  // Remove %, _, etc.  
    .replace(/\s+/g, ' ')            // Normalize spaces  
    .split(' ')
    .map((word, i) => {
      if (i === 0) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');
}
```

### MAPPING RULE  
| Bubble Field | Prisma Field | Prisma Directive |  
|------------|------------|----------------|  
| `"Invoice Date"` | `invoiceDate` | `@map("Invoice Date")` |  
| `"1st Payment %"` | `firstPaymentPercent` | `@map("1st Payment %")` |  
| `"Amount Eligible for Comm"` | `amountEligibleForComm` | `@map("Amount Eligible for Comm")` |  
| `"Stock Status INV"` | `stockStatusINV` | `@map("Stock Status INV")` |  
| `"Logs"` | `logs` | `@map("Logs")` |  
| `"Modified Date"` | `modifiedDate` | `@map("Modified Date")` |  
| `"Linked Customer"` | `linkedCustomer` | `@map("Linked Customer")` |  
| `"Commission Paid?"` | `commissionPaid` | `@map("Commission Paid?")` |  
| `"visit"` | `visit` | `@map("visit")` |  

---

## 📄 PRISMA MODEL TEMPLATE (USE FOR ALL TABLES)  
```prisma
model {PascalCaseTableName} {
  id               String    @id @default(cuid())
  bubbleId         String    @unique @map("bubble_id")
  
  // Auto-generated from Bubble fields using toCamelCase + @map()
  {dynamicFields}

  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  isDeleted        Boolean   @default(false)

  @@map("{lowercaseTableName}")
}
```

---

## 🧪 SAMPLE DATA (FROM sample_api_call.txt)  
Use this to validate field types:  
```json
{
  "Invoice Date": "2024-03-04T14:38:27.880Z",
  "1st Payment %": 5,
  "Amount Eligible for Comm": 40388.75,
  "Stock Status INV": "New | Pending",
  "Modified Date": "2025-05-30T02:18:45.183Z",
  "Commission Paid?": true,
  "visit": 10,
  "Logs": "Mark Paid Comm @ 4% of RM43200...",
  "Linked Payment": ["id1", "id2"],
  "_id": "1708327130811x106027240349761540"
}
```

---

## 🧩 DATA TYPE MAPPING (FROM SAMPLE)  
| Bubble Value | Prisma Type |  
|------------|------------|  
| String (text) | `String?` |  
| Number (int/float) | `Float?` |  
| Boolean (`true`/`false`) | `Boolean?` |  
| ISO Date String | `DateTime?` |  
| Array of strings | `String[]` |  
| Null/undefined | Use `?` (nullable) |  

---

## 🔌 SYNC ENGINE LOGIC (bubbleSyncService.js)  

### Functions:  
- `discoverDataTypes()` → returns list of tables (reuse BubbleService)  
- `generatePrismaSchema()` →  
  - For each table, fetch 3 records  
  - Extract keys → convert to camelCase → apply `@map()`  
  - Add standard fields: `bubbleId`, `isDeleted`, `updatedAt`  
  - Write to `prisma/schema.prisma`  
- `applySchema()` → run `npx prisma db push`  
- `syncDataType(tableName)` →  
  - Fetch all records (with pagination)  
  - For each record:  
    ```ts
    await prisma[tableName].upsert({
      where: { bubbleId: record._id },
      create: {
        bubbleId: record._id,
        invoiceDate: parseDate(record["Invoice Date"]),
        firstPaymentPercent: record["1st Payment %"],
        // ... all fields mapped
        isDeleted: false
      },
      update: { /* same as create */ }
    })
    ```  
- `syncAll()` →  
  - For each table in order  
  - Call `syncDataType(table)`  
  - Update `syncStatus` after each table  

---

## 🚨 ERROR HANDLING  
- On any error:  
  - Log full error message  
  - Set `syncRunning = false`  
  - Do not retry  
- Log format:  
  ```ts
  log: {
    timestamp: new Date().toISOString(),
    level: "ERROR",
    context: "sync",
    message: error.message,
    table: currentTable,
    recordId: record?._id
  }
  ```  

---

## 📡 API ENDPOINTS (FOR AI SELF-TESTING)  

### Test  
- `GET /api/test/bubble` → verify API access  
- `GET /api/test/discover-tables` → returns all Bubble tables  
- `GET /api/test/sample-data?table=invoice` → returns 3 records  

### Sync Control  
- `POST /api/admin/sync-schema` → generate + push schema  
- `POST /api/admin/sync-data` → start full sync  
- `POST /api/admin/cancel-sync` → stop sync  
- `GET /api/sync/status` → `{ running, currentTable, progress, error }`  

### Logs  
- `GET /api/logs/recent?limit=50` → last 50 logs  
- `GET /api/logs/errors?limit=20` → last 20 errors  

---

## 🚫 WHAT NOT TO DO (PAST FAILURES)  
- ❌ Do not create `FieldMappingService`  
- ❌ Do not modify `BubbleService`  
- ❌ Do not use JSONB to store raw data  
- ❌ Do not add retry logic  
- ❌ Do not process tables in parallel  
- ❌ Do not test locally  
- ❌ Do not invent new naming strategies  
- ❌ Do not assume field types — sample real data  

---

## ✅ SUCCESS CRITERIA  
- [ ] `/api/test/discover-tables` returns all Bubble tables  
- [ ] `/api/admin/sync-schema` creates all tables in PostgreSQL  
- [ ] `/api/admin/sync-data` syncs all records without error  
- [ ] All field names with spaces/special chars are preserved via `@map()`  
- [ ] No manual intervention required  
- [ ] Sync can be stopped and resumed  

---

## 🧠 AI INSTRUCTIONS  
- Do not improve working components.  
- Deploy → test via API → fix → repeat.  
- If in doubt, check `/api/logs/recent`.  
- Never assume — always validate with real API calls.  
- You are not building a framework. You are building a bridge.  
- This should take **less than 6 hours**.
```