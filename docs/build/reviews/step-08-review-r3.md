# S08 review, round 3

NEW MAJOR 4 (push loop under client clock skew) is fixed: `sameContent` in `src/services/profile/documentStore.ts` now ignores `updatedAt` and `fieldsAt`, so a server-clamped answer counts as the same content and the store settles after one push (new test in `documentStore.test.ts` passes, at most 2 puts, `dirty` false); a real value difference still differs, so it still adopts and pushes; the only thing dropped is a newer server stamp on an equal value, which cannot change any later merge result because the server remains the field-wise merge authority and a competing value with a stamp between the two would already have lost on the server. `npm run check`: 55 suites, 377 tests pass.

VERDICT: PASS
