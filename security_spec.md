# Security Specification - Gridiron Clash

## Data Invariants
1. A User document can only be read or written by the owner (UID match).
2. A User cannot modify their own `gridIrons` directly in a way that skips transactions, although the client currently does full-document updates. We should harden this to prevent arbitrary balance setting.
3. Auction listings must have a valid `sellerUserId` matching the requester's UID.
4. Players can only be bought if the buyer has sufficient `gridIrons`. (Enforced by rules).
5. A user can only join a lobby if it is in 'waiting' status.

## The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Attempt to update another user's profile.
   - Path: `/users/other-user-id`
   - Payload: `{ "gridIrons": 999999 }`
   - Expected: `PERMISSION_DENIED`

2. **Shadow Field Injection**: Attempt to add an `isAdmin` field to a user document.
   - Path: `/users/my-user-id`
   - Payload: `{ "isAdmin": true, ...existingData }`
   - Expected: `PERMISSION_DENIED` (via `hasOnly` check)

3. **Auction Hijack**: Attempt to delete an auction listing owned by someone else.
   - Path: `/clash_auctions/someone-elses-auction`
   - Expected: `PERMISSION_DENIED`

4. **Price Manipulation**: Attempt to list a card for a negative price.
   - Path: `/clash_auctions/new-auction`
   - Payload: `{ "buyNowPrice": -100, ... }`
   - Expected: `PERMISSION_DENIED`

5. **Self-Buying**: Attempt to buy your own auction listing (if forbidden).
   - Expected: `PERMISSION_DENIED`

6. **Lobby Poaching**: Attempt to join a lobby that is already `in_progress`.
   - Path: `/clash_rooms/busy-room`
   - Payload: `{ "status": "in_progress", "guestUserId": "attacker-id" }`
   - Expected: `PERMISSION_DENIED`

7. **Leaderboard Spoofing**: Attempt to update someone else's leaderboard entry.
   - Path: `/clash_leaderboard/other-user-id`
   - Expected: `PERMISSION_DENIED`

8. **Resource Poisoning**: Send a 1MB string as a team name.
   - Payload: `{ "teamName": "A".repeat(1024 * 1024) }`
   - Expected: `PERMISSION_DENIED`

9. **Orphaned Auction**: Create an auction listing without a valid `sellerUserId`.
   - Expected: `PERMISSION_DENIED`

10. **State Skipping**: Update a match sync state directly without being in the room.
    - Expected: `PERMISSION_DENIED`

11. **Timestamp Spoofing**: Provide a future `updatedAt` timestamp.
    - Expected: `PERMISSION_DENIED`

12. **Anonymous Write**: Attempt to write without being logged in.
    - Expected: `PERMISSION_DENIED`

## Test Runner (Conceptual)
A `firestore.rules.test.ts` would be used to verify these cases using the Firebase Emulator.
