# Known Issues and Investigation Notes

## Match Score Discrepancy Between Group and Global Matches
**Status**: To Investigate  
**Date Added**: January 27, 2025  
**Priority**: Medium  

### Description
There is a discrepancy in match scores between the group page and the global matches page. The same pair of users can have different match scores in different contexts.

**Example**:
- Users "r" and "testuser" show:
  - 47% match score in group context
  - 60% match score in global matches page

### Affected Files
- `client/src/pages/matches-page.tsx`
- `client/src/pages/group-page.tsx`
- `client/src/utils/match-utils.ts`

### Initial Analysis
Both pages use the same underlying utility functions from `match-utils.ts`, but there might be differences in:
1. How the semantic embeddings are weighted
2. The order of comparison (who is user1 vs user2)
3. How the basic match score is combined with semantic scores

### Investigation Steps
1. Compare the exact scoring algorithm implementation in both pages
2. Verify the data flow and how user roles (user1/user2) are assigned
3. Add logging to track score calculations
4. Consider standardizing the match calculation into a single shared function

### Notes
- Both pages should use identical scoring algorithms for consistency
- Need to verify if the difference in context (group vs global) should affect scoring
