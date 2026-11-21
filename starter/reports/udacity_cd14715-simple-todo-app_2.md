# 🔍 Code Review Report

## Summary

| Metric | Value |
|--------|-------|
| **Overall Score** | 45/100 |
| **Files Reviewed** | 1 |
| **Critical Issues** | 3 |
| **High Priority Tests** | 14 |
| **Refactoring Opportunities** | 8 |

## 🎯 Top Recommendations

1. 🚨 **security**: Fix SQL injection vulnerabilities in searchTodos, searchTodosByStatus, and getTodosByUser by replacing string concatenation with parameterized queries
   - Files: src/todo.ts

2. 🚨 **test-coverage**: Add security tests to verify SQL injection prevention in all three search functions with malicious input
   - Files: src/todo.ts

3. 🚨 **test-coverage**: Add tests for createTodo function covering database insertion, error handling, and return value validation
   - Files: src/todo.ts

4. ⚠️ **test-coverage**: Add comprehensive test coverage for getAllTodos, getTodoById, updateTodoStatus, and deleteTodo functions
   - Files: src/todo.ts

5. ⚠️ **refactoring**: Replace string concatenation with parameterized queries in search functions to eliminate SQL injection vulnerabilities
   - Files: src/todo.ts

## 📁 File Details

### 📄 `src/todo.ts`

**Quality Score:** 45/100 | **Coverage:** ~15%

#### Issues (10)
  - Line 118: `critical` SQL injection vulnerability in searchTodos function - user input 'keyword' is directly interpolated into SQL query using template literals
  - Line 127: `critical` SQL injection vulnerability in searchTodosByStatus function - user input 'completed' is directly concatenated into SQL query without validation or parameterization
  - Line 136: `critical` SQL injection vulnerability in getTodosByUser function - userId is directly interpolated into SQL query using template literals without sanitization

  *...and 7 more*

#### Test Gaps (16)
  - `createTodo` (critical priority)
  - `createTodo` (high priority)

  *...and 14 more*

#### Refactoring Opportunities (8)
  - **simplify**: Replace multiple if-return statements with early returns and combine validation logic to reduce nesting and improve readability
  - **modernize**: Replace chained replace calls with a single replace using a lookup object for better performance and maintainability

  *...and 6 more*

---

*Generated at 2026-11-21T22:51:34.125Z • Duration: 141018ms*
