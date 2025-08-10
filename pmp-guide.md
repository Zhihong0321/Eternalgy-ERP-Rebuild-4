# Persistent Memory Protocol (PMP) – Daily Use Guide

## Purpose
PMP is your long-term project memory system. It stores critical information in `.memory` files inside the `/memory` folder.  
This ensures consistency across sessions and agents, removing dependency on unreliable chat history.

## Core Principles
1. Always check relevant `.memory` files **before** planning or coding.
2. `.memory` files outrank chat history for accuracy.
3. Never guess — if unsure, ask the user.
4. Immediately update `.memory` files when new critical info appears.
5. Keep entries short, structured, and up-to-date.

## Memory File Schema
/memory/
project_spec.memory # Goals, scope, architecture, roadmap
config.memory # Deployment info, environment, DB/API URLs (online only)
critical_instruction.memory # Non-negotiable rules & workflows
my_mistake.memory # Mistakes to avoid repeating
persistent_bug.memory # Known unresolved bugs
udls.memory # Unified Debug & Logging Strategy
security.memory # Security policies & audit notes

markdown
Copy
Edit

## Workflow
1. **Identify** relevant `.memory` files for the task.
2. **Read** those files before reasoning.
3. **Plan** work using `.memory` + user request.
4. **Execute** only when aligned with `.memory` content.
5. **Update** `.memory` immediately when new facts arise.

## Maintenance
- Keep files ≤ 500 tokens each.
- Archive outdated content to `/memory/archive/`.
- Use bullet points and consistent formatting for easy parsing.