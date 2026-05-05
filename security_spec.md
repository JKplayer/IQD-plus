# Security Specification - IQD+

## Data Invariants
1. A User profile must be created by the owner with an initial balance of 0.
2. Investments must reference a valid user and a valid package price.
3. Transactions must be system-validated (created by owner but mostly system-issued payouts). Payouts should only be created if the investment logic holds (verified via backend or strict rules).
4. Users cannot modify their own balance directly via client side.
5. Referral rewards are calculated and added by the system.

## The "Dirty Dozen" Payloads (Denial Expected)
1. **Identity Spoofing**: Attempt to create a user profile for a different UID.
2. **Balance Injection**: User attempts to update their `balance` field to 1,000,000.
3. **Role Escalation**: User attempts to set `role: 'admin'`.
4. **Invalid Package**: Investment creation with a negative amount.
5. **Orphaned Investment**: Creating an investment without an existing user.
6. **Payout Self-Creation**: User creates a 'payout' transaction for themselves.
7. **Referral Loop**: Setting `referredBy` to one's own UID.
8. **Negative Deposit**: Transaction with negative amount.
9. **History Erasure**: User attempts to delete a transaction record.
10. **Shadow Field**: Adding `isVerified: true` to a profile when not in schema.
11. **ID Poisoning**: Document ID with 2KB junk characters.
12. **Future Timestamp**: Setting `createdAt` to a future date.

## Test Runner (Logic Verification)
I will implement `firestore.rules` and verify against these cases.
