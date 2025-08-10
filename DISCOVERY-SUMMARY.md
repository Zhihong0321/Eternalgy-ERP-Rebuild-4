# Bubble Discovery Summary

## Overview
**Discovery Timestamp:** 2025-08-09T08:51:09.078Z  
**API Base URL:** https://eternalgy.bubbleapps.io  
**Connection Status:** ✅ Successful (Status: 200)

## Live Data Types Confirmed (7 Types)

### 1. User
- **Endpoint:** `/api/1.1/obj/user`
- **Field Count:** 10
- **Sample Records:** 1
- **Test Timestamp:** 2025-08-09T08:51:10.120Z

**Raw Field Names:**
- `authentication` (object)
- `Modified Date` (string)
- `_id` (string)
- `Dealership` (string)
- `check in report today` (string)
- `Profile Picture` (string)
- `Access Level` (array) ⚡
- `user_signed_up` (boolean)
- `Linked Agent Profile` (string) 🔗
- `Created Date` (string)

**Relationship Hints:** 
- `Linked Agent Profile` → agent relationship

### 2. Invoice
- **Endpoint:** `/api/1.1/obj/invoice`
- **Field Count:** 39
- **Sample Records:** 1
- **Test Timestamp:** 2025-08-09T08:51:11.400Z

**Raw Field Names:**
- `Invoice ID` (number)
- `Linked Stock Transaction` (array) ⚡🔗
- `Linked Agreement` (string) 🔗
- `Last Payment Date` (string)
- `Eligible Amount Description` (string)
- `Created By` (string)
- `Amount` (number)
- `Dealercode` (string)
- `Locked Package?` (boolean)
- `Linked SEDA registration` (string) 🔗
- `Linked Payment` (array) ⚡🔗
- `2nd Payment %` (number)
- `Linked Customer` (string) 🔗
- `Linked Package` (string) 🔗
- `Stamp Cash Price` (number)
- `Commission Paid?` (boolean)
- `Linked Agent` (string) 🔗
- `_id` (string)
- `Invoice Date` (string)
- `Stock Status INV` (string)
- `Created Date` (string)
- `Type` (string)
- `Approval Status` (string)
- `Performance Tier Month` (number)
- `Full Payment Date` (string)
- `Percent of Total Amount` (number)
- `Linked Invoice Item` (array) ⚡🔗
- `1st Payment %` (number)
- `Modified Date` (string)
- `Paid?` (boolean)
- `Normal Commission` (number)
- `1st Payment Date` (string)
- `Performance Tier Year` (number)
- `Need Approval` (boolean)
- `Version` (number)
- `Amount Eligible for Comm` (number)
- `Logs` (string)
- `Panel Qty` (number)
- `visit` (number)

**Relationship Hints:**
- `Linked Payment` → payment relationship (array)
- `Linked Package` → package relationship
- `Linked Agent` → agent relationship
- `Linked Customer` → user relationship
- `Linked Invoice Item` → product/item relationship (array)

### 3. Payment
- **Endpoint:** `/api/1.1/obj/payment`
- **Field Count:** 9
- **Sample Records:** 1
- **Test Timestamp:** 2025-08-09T08:51:12.053Z

**Raw Field Names:**
- `Payment Date` (string)
- `Amount` (number)
- `Linked Agent` (string) 🔗
- `Created Date` (string)
- `Remark` (string)
- `_id` (string)
- `Created By` (string)
- `Payment Method` (string)
- `Modified Date` (string)

**Relationship Hints:**
- `Linked Agent` → agent relationship

### 4. Agent
- **Endpoint:** `/api/1.1/obj/agent`
- **Field Count:** 15
- **Sample Records:** 1
- **Test Timestamp:** 2025-08-09T08:51:13.657Z

**Raw Field Names:**
- `Modified Date` (string)
- `Created Date` (string)
- `Created By` (string)
- `Slug` (string)
- `Agent Type` (string)
- `Name` (string)
- `Linked User Login` (string) 🔗
- `Contact` (string)
- `Commission` (number)
- `TREE SEED` (string)
- `Current Annual Sales` (number)
- `Annual Collection` (number)
- `Last Update Annual Sales` (string)
- `Intro Youtube` (string)
- `_id` (string)

**Relationship Hints:**
- `Linked User Login` → user relationship

### 5. Package
- **Endpoint:** `/api/1.1/obj/package`
- **Field Count:** 15
- **Sample Records:** 1
- **Test Timestamp:** 2025-08-09T08:51:14.253Z

**Raw Field Names:**
- `Active` (boolean)
- `_id` (string)
- `Type` (string)
- `Price` (number)
- `Need Approval` (boolean)
- `Modified Date` (string)
- `Panel Qty` (number)
- `Special?` (boolean)
- `Panel` (string)
- `Created Date` (string)
- `Linked Package Item` (array) ⚡🔗
- `Max Discount` (number)
- `Invoice Desc` (string)
- `Created By` (string)
- `Package Name` (string)

**Relationship Hints:**
- `Linked Package Item` → product relationship (array)

### 6. Product
- **Endpoint:** `/api/1.1/obj/product`
- **Field Count:** 19
- **Sample Records:** 1
- **Test Timestamp:** 2025-08-09T08:51:17.776Z

**Raw Field Names:**
- `Product Warranty (Desc)` (string)
- `Solar Output Rating` (number)
- `Selling Price` (number)
- `Cost Price` (number)
- `Created By` (string)
- `Image` (string)
- `Description` (string)
- `Linked Brand` (string) 🔗
- `PDF Product` (string)
- `Inventory` (boolean)
- `_id` (string)
- `Active?` (boolean)
- `Modified Date` (string)
- `Created Date` (string)
- `Warranty Link` (string)
- `Warranty Name` (string)
- `Label` (string)
- `Linked Category` (string) 🔗
- `Name` (string)

**Relationship Hints:**
- `Linked Brand` → brand relationship
- `Linked Category` → category relationship

### 7. Category
- **Endpoint:** `/api/1.1/obj/category`
- **Field Count:** 6
- **Sample Records:** 1
- **Test Timestamp:** 2025-08-09T08:51:18.378Z

**Raw Field Names:**
- `Created Date` (string)
- `Linked Products` (array) ⚡🔗
- `Category Name` (string)
- `Created By` (string)
- `_id` (string)
- `Modified Date` (string)

**Relationship Hints:**
- `Linked Products` → product relationship (array)

## API Constraints & Limitations

### Rate Limits
- **Test Requests:** 5 requests
- **Total Time:** 1,614ms
- **Average Response Time:** 322.8ms
- **Status:** ✅ No rate limit errors detected
- **Notes:** Basic rate limit test completed successfully

### Pagination
- **Test Data Type:** user
- **Requested Limit:** 100 records
- **Actual Records Returned:** 100 records
- **Has More Data:** ✅ Yes
- **Cursor Token Behavior:** Uses numeric cursor (starts at 0)
- **Pagination Method:** Cursor-based pagination

### Latency Analysis
- **Average API Response Time:** 322.8ms
- **Connection Test:** 200ms (successful)
- **Data Retrieval Range:** 1.4s - 8.4s for full discovery across 7 data types

## Field Analysis Patterns

### Common Field Types
- **Strings:** Most common (dates, IDs, names, descriptions)
- **Numbers:** Amounts, percentages, quantities, ratings
- **Booleans:** Status flags, approval states
- **Arrays:** Relationship collections, access levels
- **Objects:** Authentication data

### Naming Conventions
- **With Spaces:** 80+ fields (e.g., "Modified Date", "Created By")
- **Special Characters:** _id, percentages (%), question marks (?)
- **CamelCase:** Limited use (authentication, visit)
- **ALL CAPS:** TREE SEED
- **Numbers in Names:** 1st/2nd Payment fields

### Standard System Fields
All data types include:
- `_id` (string) - Unique identifier
- `Created Date` (string) - Creation timestamp
- `Modified Date` (string) - Last update timestamp
- `Created By` (string) - Creator reference

## Relationship Mapping

### Primary Relationships
- **User ↔ Agent:** `Linked Agent Profile` / `Linked User Login`
- **Invoice → Payment:** `Linked Payment` (array)
- **Invoice → Package:** `Linked Package`
- **Invoice → Agent:** `Linked Agent`
- **Package → Product:** `Linked Package Item` (array)
- **Product → Category:** `Linked Category`
- **Category → Product:** `Linked Products` (array)

### Data Model Hierarchy
```
User → Agent
         ↓
     Invoices → Payments
         ↓
     Packages → Products → Categories
```

## Recommendations for Development

1. **Pagination Strategy:** Implement cursor-based pagination with 100-record limits
2. **Response Time Optimization:** Plan for ~300ms average API response times
3. **Field Validation:** Handle mixed naming conventions (spaces, special chars)
4. **Relationship Handling:** Build robust handlers for array-based relationships
5. **Data Consistency:** All records include standard audit fields (created/modified dates)

## Sample Data Location
Sample JSON files available at:
- `samples/user_sample.json` (3 records)
- `samples/invoice_sample.json` (3 records)  
- `samples/payment_sample.json` (3 records)
- `samples/agent_sample.json` (3 records)
- `samples/package_sample.json` (3 records)
- `samples/product_sample.json` (3 records)
- `samples/category_sample.json` (3 records)

---
**Legend:**
- ⚡ = Array field
- 🔗 = Relationship field
- ✅ = Confirmed/Working
