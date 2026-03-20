# PROMPT: Database Schema

**Priority**: P0
**Status**: READY TO START
**Estimated Time**: 3 hours
**Agent Type**: Database Agent
**Dependencies**: None

## Objective

Create the initial database schema for the application.

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL
);
```

## Success Criteria

- [ ] Tables created
- [ ] RLS policies applied
