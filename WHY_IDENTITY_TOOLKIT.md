# Why Are We Hitting Google Identity Toolkit?

## Short Answer

**That IS Firebase!** `identitytoolkit.googleapis.com` is Firebase Authentication's backend service. This is normal and expected.

---

## What's Happening

When you call `signInWithEmailAndPassword()` from Firebase SDK:

```
Frontend: signInWithEmailAndPassword(email, password)
    ↓
Firebase Client SDK
    ↓
Google Identity Toolkit API (identitytoolkit.googleapis.com)
    ↓
Firebase Authentication Service
    ↓
Returns: User object or error
```

**This is the correct flow!** Firebase Auth uses Google Identity Toolkit under the hood.

---

## The Real Issue: `auth/invalid-credential`

The error `auth/invalid-credential` means:

1. ✅ **Firebase user exists** (created by `ensureFirebaseUser`)
2. ❌ **BUT password is wrong OR not set yet**

### Scenario A: User Hasn't Completed Activation
- Firebase user was created (no password)
- User tries to login before setting password
- **Solution:** User must complete activation flow first

### Scenario B: User Set Password But It's Wrong
- User completed activation
- User enters wrong password
- **Solution:** User needs to use the password they set

### Scenario C: Password Wasn't Set Correctly
- User went through activation
- But `/api/set-password` failed silently
- **Solution:** Check backend logs for set-password errors

---

## Activation Flow (Must Complete First)

```
1. Admin generates invite link
   → /api/invite/send creates Firebase user (NO PASSWORD)

2. User clicks activation link
   → /activate?token=xxx

3. User sets password
   → /set-password → /api/set-password sets Firebase password

4. NOW user can login
   → signInWithEmailAndPassword(email, password)
```

**Key Point:** User CANNOT login until step 3 is complete!

---

## Debugging Steps

### 1. Check if Firebase User Exists
```javascript
// In Firebase Console or via Admin SDK
admin.auth().getUserByEmail('joel@businesspointlaw.com')
```

### 2. Check if Contact Has firebaseUid
```sql
SELECT id, email, "firebaseUid", "isActivated" 
FROM contacts 
WHERE email = 'joel@businesspointlaw.com';
```

### 3. Check if Password Was Set
- Look for `/api/set-password` calls in logs
- Check if `isActivated = true` in database

### 4. Test Activation Flow
- Generate new invite link
- Complete activation
- Try login again

---

## Common Issues

### Issue: "User not found" but Firebase user exists
**Cause:** Contact.firebaseUid is not set  
**Fix:** Run activation flow or manually link:
```sql
UPDATE contacts 
SET "firebaseUid" = 'firebase-uid-here' 
WHERE email = 'user@example.com';
```

### Issue: "Invalid credential" after activation
**Cause:** Password wasn't set correctly  
**Fix:** Check `/api/set-password` logs, regenerate invite link

### Issue: User can't find activation link
**Cause:** Email not sent or link expired  
**Fix:** Generate new invite link from contact detail page

---

## The URL is Correct!

✅ `identitytoolkit.googleapis.com` = Firebase Auth backend  
✅ This is where ALL Firebase email/password auth goes  
✅ This is normal and expected behavior  

**We ARE hitting Firebase** - it just uses Google Identity Toolkit as the backend service.

---

**Last Updated:** 2025-11-12  
**Status:** ✅ Normal Firebase behavior

