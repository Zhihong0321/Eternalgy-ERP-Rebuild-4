# Persistent Memory Protocol (PMP) – First Run Setup

## Purpose
This guide initializes PMP for a new project.  
Once completed, set a `pmp-setup-complete` flag in `/memory` so AI agents skip this step in future sessions.

---

## Step 1 – Create `/memory` Folder
Inside your project root, create:
/memory/
project_spec.memory
config.memory
critical_instruction.memory
my_mistake.memory
persistent_bug.memory
udls.memory
security.memory

yaml
Copy
Edit

---

## Step 2 – Populate from Project Spec
Using `project_spec.md` or equivalent:
- Summarize **project goals, scope, and architecture** into `project_spec.memory`.
- Record **deployment, environment, DB/API URLs** (online only) in `config.memory`.
- Copy **non-negotiable rules** into `critical_instruction.memory`.

---

## Step 3 – Seed Known Issues & Rules
- Add **known mistakes** to `my_mistake.memory`.
- Add **open bugs** to `persistent_bug.memory`.
- Insert logging/debugging rules into `udls.memory`.
- Add **security constraints** to `security.memory`.

---

## Step 4 – Validation Checklist
Before declaring setup complete, confirm:
- All `.memory` files exist and contain at least 1 bullet point.
- No local/localhost endpoints in `config.memory`.
- All deployment targets are online services.
- Critical instructions are clear and actionable.

---

## Step 5 – Archive
Move unused or outdated info to `/memory/archive/` for future reference.

---

## Step 6 – Mark Setup Complete
Create a file `/memory/pmp-setup-complete` containing:
PMP setup complete: YYYY-MM-DD

rust
Copy
Edit
This signals that PMP is ready for daily use.
