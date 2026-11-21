# 🔍 Code Review Report

## Summary

| Metric | Value |
|--------|-------|
| **Overall Score** | 45/100 |
| **Files Reviewed** | 1 |
| **Critical Issues** | 3 |
| **High Priority Tests** | 10 |
| **Refactoring Opportunities** | 8 |

## 🎯 Top Recommendations

1. 🚨 **security**: Fix SQL injection vulnerabilities in searchTodos, searchTodosByStatus, and getTodosByUser by using parameterized queries instead of string concatenation.
   - Files: src/todo.ts

2. 🚨 **test-coverage**: Add security tests for vulnerable search functions to verify SQL injection risks and ensure fixes work correctly.
   - Files: src/todo.ts

3. ⚠️ **test-coverage**: Add comprehensive tests for core CRUD operations (createTodo, getAllTodos, getTodoById, updateTodoStatus, deleteTodo).
   - Files: src/todo.ts

4. 📝 **bug-risk**: Replace custom ID generation with crypto.randomUUID() to prevent ID collision issues.
   - Files: src/todo.ts

5. 📝 **performance**: Consider implementing full-text search or database-specific search indexing to improve search performance.
   - Files: src/todo.ts

## 📁 File Details

### 📄 `src/todo.ts`

**Quality Score:** 45/100 | **Coverage:** ~15%

#### Issues (8)
  - Line 118: `critical` SQL injection vulnerability: User input 'keyword' is directly interpolated into SQL query using template literal without sanitization or parameterization
  - Line 129: `critical` SQL injection vulnerability: User input 'completed' is directly concatenated into SQL query without validation or parameterization
  - Line 139: `critical` SQL injection vulnerability: User input 'userId' is directly interpolated into SQL query using template literal without sanitization or parameterization

  *...and 5 more*

#### Test Gaps (14)
  - `createTodo` (high priority)
  - `createTodo` (high priority)

  *...and 12 more*

#### Refactoring Opportunities (8)
  - **simplify**: Replace multiple if-return statements with early returns and combine validation logic more clearly
  - **extract-function**: Extract sanitization logic into a separate function that handles both title and description

  *...and 6 more*

---

*Generated at 2026-11-21T19:35:08.836Z • Duration: 133601ms*
