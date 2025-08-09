Here’s the `.md` document based on your requirements — keeping it **simple, consistent, and implementation-ready**.

---

```markdown
# Unified Debug & Logging Strategy (UDLS)

## Overview
The **Unified Debug & Logging Strategy (UDLS)** defines a simple yet robust approach to implementing debug and logging features in all project code during **Implementation Mode**.

The goal:
- Minimize blind bug hunting
- Provide clear, consistent, and easily accessible runtime logs
- Ensure every run has a unique traceable identity
- Maintain historical logs for review and debugging

---

## 1. Core Principles
1. **Always Include Logging in Implementation Mode**  
   - All generated code must contain built-in logging following this strategy.  
   - Code without logs is considered incomplete.

2. **Simplicity Over Complexity**  
   - The simplest solution that works should be chosen first.  
   - Avoid heavy logging frameworks unless specifically required.

3. **Run-Scoped Logging**  
   - Each execution/run has a unique **Run ID** (timestamp-based or UUID).
   - Logs from that run are tagged with the Run ID for easy filtering.

4. **Historical Retention**  
   - Logs are never overwritten automatically.  
   - Old logs remain in `log_history` for future reference.  
   - Manual log clearing is possible via API call.

---

## 2. Logging Structure

### 2.1 Log Levels
- **INFO** – General runtime events (function start/end, user actions)
- **DEBUG** – Detailed diagnostic information (variable states, computation steps)
- **WARN** – Recoverable issues (invalid input handled gracefully)
- **ERROR** – Failures or exceptions that require attention

---

### 2.2 Log Format
Each log entry should follow this format:
```

\[YYYY-MM-DD HH\:MM\:SS] \[RUN\_ID: <uuid>] \[LEVEL] \[MODULE/FUNCTION] - <message>

```

Example:
```

\[2025-08-09 15:12:34] \[RUN\_ID: 9f8e12ac] \[DEBUG] \[user\_auth.login] - User 'john' authentication started.

````

---

### 2.3 Storage
- **Current Run Log:** `runtime.log` (cleared automatically at each new run)
- **Historical Logs:** `/log_history/<RUN_ID>.log`
- **Log Retention:** All historical logs are stored unless manually cleared.

---

## 3. Log Accessibility

### 3.1 Primary Access (Simple HTTP Endpoint)
- Expose logs over HTTP for quick access.
- Example:
  - `/latestlog` → returns `runtime.log`
  - `/log/<RUN_ID>` → returns specific run log

---

### 3.2 Alternative Access
- Local AI IDE can fetch logs via HTTP GET request.
- Railway app hosts a simple endpoint for log retrieval.
- Optional: API route `/clearlogs` to manually delete all logs.

---

## 4. AI Development Rules
When **Implementation Mode** is active:
1. Always reference this UDLS document before writing code.
2. Integrate logging at:
   - Function entry & exit
   - Key variable states
   - Conditional branches
   - Exceptions and error handling
3. Include Run ID generation at application start.
4. Write logs in both `runtime.log` and append to `log_history`.

---

## 5. Example Minimal Logging Snippet (Python)
```python
import logging
import os
from datetime import datetime
import uuid

RUN_ID = str(uuid.uuid4())
LOG_DIR = "logs"
HISTORY_DIR = os.path.join(LOG_DIR, "log_history")
RUNTIME_LOG = os.path.join(LOG_DIR, "runtime.log")

os.makedirs(HISTORY_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.DEBUG,
    format=f"[%(asctime)s] [RUN_ID: {RUN_ID}] [%(levelname)s] [%(module)s.%(funcName)s] - %(message)s",
    handlers=[
        logging.FileHandler(RUNTIME_LOG, mode='w'),
        logging.FileHandler(os.path.join(HISTORY_DIR, f"{RUN_ID}.log")),
        logging.StreamHandler()
    ]
)

logging.info("Application started.")
````

---

## 6. Benefits of UDLS

* **Traceability:** Every run has a unique ID.
* **Historical Insight:** Easy to compare current vs. past runs.
* **Reduced Debug Time:** Clear function-level and variable-level logging.
* **AI-Friendly:** AI can read `/latestlog` to diagnose issues without scanning entire codebase.
* **Human-Friendly:** Simple URL access to logs without needing special tools.


