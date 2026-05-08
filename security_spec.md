# Firestore Security Specification - Salvation Ministries Ada George

## Data Invariants
1. Only the authorized administrator (danielgiobari644@gmail.com) can modify settings, content, sermons, and events.
2. Testimonies can be submitted by anyone but must be approved by an admin before becoming publicly readable.
3. Messages (contact form) can be submitted by anyone but only read by an admin.
4. All text fields must have reasonable size limits to prevent abuse.
5. All IDs must be strictly validated.

## The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Attempt to update `settings/theme` as an unauthenticated user.
2. **Privilege Escalation**: Attempt to set `approved: true` on a testimony as a non-admin.
3. **Shadow Update**: Add a `isVerifiedAdmin: true` field to a user profile or settings document.
4. **PII Leak**: Attempt to list all `messages` as a non-admin.
5. **ID Poisoning**: Attempt to create a testimony with a 1MB string as the document ID.
6. **Resource Exhaustion**: Send a `Testimony` with a 1MB `message` field.
7. **Bypassing Terminal State**: (Not applicable here, but good to check if statuses existed).
8. **Orphaned Write**: Create a sermon without a title or date.
9. **Malicious Array**: Send `heroImages` with 10,000 items.
10. **Type Mismatch**: Send a boolean where a string is expected for `primaryColor`.
11. **Spam Attack**: Attempt to create 100 messages in 1 second (Requires Rate Limiting logic if possible, or simple schema guards).
12. **Metadata Tampering**: Attempt to set `submittedAt` to a future date manually instead of using server time.

## Test Runner (Logic Overview)
- `isAdmin()` checks if `request.auth.token.email == "danielgiobari644@gmail.com"` and `token.email_verified == true`.
- `isValidTestimony(data)` ensures `approved` defaults to false on create and message length is bounded.
- `isValidMessage(data)` ensures the email format is plausible and fields are required.
- `isValidSettings(data)` ensures color strings match regex and mode is one of the enum values.
