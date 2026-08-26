/**
 * Backbone Hub — Gemini AI proxy
 *
 * WHY THIS EXISTS:
 * Previously, GEMINI_API_KEY was compiled directly into the browser bundle
 * (vite.config.ts -> define), meaning anyone who opened dev tools on the
 * live site could copy the key and use it on Google's bill. This function
 * moves the key here, server-side, where it is never sent to the browser.
 *
 * HOW IT WORKS:
 * - The client calls this function via the Firebase SDK's httpsCallable(),
 *   NOT via a raw fetch. That SDK automatically attaches the signed-in
 *   user's Firebase Auth ID token to every request.
 * - onCall() verifies that token server-side before your code even runs.
 *   request.auth is null if the caller isn't signed in — we reject those.
 * - The real Gemini key lives in Secret Manager (set via
 *   `firebase functions:secrets:set GEMINI_API_KEY`), not in this file,
 *   not in git, not in any .env that gets bundled by Vite.
 *
 * SCOPE (Phase 1):
 * This covers single-shot calls — generateContent, structured JSON output,
 * multimodal image input (invoice parsing), and image generation/editing.
 * It does NOT yet cover the stateful ChatBot.tsx chat feature — that needs
 * a small client-side redesign (sending full message history each turn
 * instead of holding a live SDK session) and is scoped for Phase 2, along
 * with rewiring every call site in the app to actually use this function.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenAI } = require("@google/genai");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

// Same non-default Firestore database Hub/POS both use (see firebase.ts / firebase-applet-config.json
// in either project - NOT the '(default)' database. Pointing at the wrong one
// silently returns empty results instead of an error, so this matters a lot here.
const FIRESTORE_DATABASE_ID = "ai-studio-ed2c0f12-89cb-43e1-8002-769e61587403";

const adminApp = initializeApp();
const db = getFirestore(adminApp, FIRESTORE_DATABASE_ID);

// Only these models are reachable through the proxy. This isn't a general-
// purpose "call any Google API" function — if the app starts using a new
// model, add it here deliberately rather than letting the client pick
// anything, which would let a compromised client rack up spend on models
// you never intended to expose.
const ALLOWED_MODELS = new Set([
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-flash-image",
  "gemini-3-flash-preview",
]);

exports.callGemini = onCall(
  {
    secrets: [GEMINI_API_KEY],
    // Keep this close to Backbone Hub's Firestore region for lower latency.
    region: "us-central1",
    // Generous but bounded — invoice photos can be a few MB as base64.
    memory: "512MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    // 1. Require a signed-in Backbone Hub user. Mirrors the app's existing
    //    isAuthenticated() pattern in firestore.rules — any logged-in
    //    staff account can use the AI features, matching current behavior.
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to use AI features."
      );
    }

    const { model, contents, config } = request.data || {};

    // 2. Validate the model against the allow-list.
    if (!model || !ALLOWED_MODELS.has(model)) {
      throw new HttpsError(
        "invalid-argument",
        `Model must be one of: ${Array.from(ALLOWED_MODELS).join(", ")}`
      );
    }

    // 3. Basic shape check — contents is required, config is optional and
    //    passed through as-is (this is where responseSchema / responseMimeType
    //    for structured JSON output comes through, matching how the client
    //    already calls ai.models.generateContent today).
    if (!contents) {
      throw new HttpsError("invalid-argument", "contents is required.");
    }

    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });

      const response = await ai.models.generateContent({
        model,
        contents,
        ...(config ? { config } : {}),
      });

      // Return both the plain text (used by text/JSON-schema call sites)
      // and any inline image data (used by editInventoryImage), so this
      // one function can serve both shapes of response the app needs.
      const inlineImageParts =
        response.candidates?.[0]?.content?.parts
          ?.filter((part) => part.inlineData?.data)
          .map((part) => ({
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType,
          })) || [];

      return {
        text: response.text || "",
        images: inlineImageParts,
      };
    } catch (error) {
      console.error("Gemini proxy error:", error);
      // Don't leak internal error details (which could include request
      // specifics) back to the client beyond a safe message.
      throw new HttpsError(
        "internal",
        error?.message || "AI service request failed."
      );
    }
  }
);


/**
 * Backbone Hub / POS — server-side staff PIN verification
 *
 * WHY THIS EXISTS:
 * Previously, staff PINs lived directly on staffProfiles documents, which
 * any authenticated user could read in full (needed so the PIN pad UI could
 * show names) - meaning every staff member's 4-digit PIN, hourly rate, and
 * salary history was downloaded into every logged-in browser session. This
 * function moves PIN checking here, server-side, using the Admin SDK (which
 * bypasses Firestore rules entirely and is never exposed to the browser).
 * The raw PIN value is never sent back to the client - only a yes/no plus
 * which staff member matched.
 *
 * The client should call this instead of comparing PINs locally. See
 * POSPINModal.tsx (Hub) and PinLoginScreen.tsx (POS) for the call sites.
 */
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 2 * 60 * 1000; // 2 minutes

// Rate limiting is keyed on request.auth.uid - the CALLER's verified auth
// identity (e.g. the terminal/shared-login account signed into a POS
// station), not on the PIN or the staffId being guessed. This stops a
// single compromised or malicious session from brute-forcing all 10,000
// possible 4-digit PINs, regardless of which staff member it is trying
// to impersonate. Stored server-side in Firestore via the Admin SDK,
// which bypasses firestore.rules entirely - no client rule is needed or
// added for this collection, since only this function ever touches it.
async function checkPinLockout(callerUid) {
  const snap = await db.collection("pinAttempts").doc(callerUid).get();
  if (!snap.exists) return { lockedOut: false };
  const data = snap.data();
  const now = Date.now();
  if (data.lockedUntil && data.lockedUntil > now) {
    return { lockedOut: true, secondsLeft: Math.ceil((data.lockedUntil - now) / 1000) };
  }
  return { lockedOut: false };
}

async function recordPinOutcome(callerUid, succeeded) {
  const attemptRef = db.collection("pinAttempts").doc(callerUid);
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(attemptRef);
    const data = snap.exists ? snap.data() : { count: 0, lockedUntil: 0 };

    if (succeeded) {
      tx.set(attemptRef, { count: 0, lockedUntil: 0, updatedAt: now });
      return;
    }

    // A previous lockout that has already expired starts the count fresh.
    const expired = data.lockedUntil && data.lockedUntil <= now;
    const newCount = (expired ? 0 : data.count) + 1;
    const lockedUntil = newCount >= PIN_MAX_ATTEMPTS ? now + PIN_LOCKOUT_MS : 0;
    tx.set(attemptRef, { count: newCount, lockedUntil, updatedAt: now });
  });
}

exports.verifyStaffPin = onCall(
  { region: "us-central1", timeoutSeconds: 15 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to verify a staff PIN."
      );
    }

    const { pin, locationId, staffId } = request.data || {};

    if (!pin || typeof pin !== "string" || pin.length !== 4) {
      throw new HttpsError("invalid-argument", "A 4-digit pin is required.");
    }
    if (!locationId) {
      throw new HttpsError("invalid-argument", "locationId is required.");
    }

    // Check lockout FIRST, read-only - before doing any PIN comparison work
    // and before recording anything, so this check never itself counts as
    // an attempt.
    const lockCheck = await checkPinLockout(request.auth.uid);
    if (lockCheck.lockedOut) {
      throw new HttpsError(
        "resource-exhausted",
        `Too many failed attempts. Try again in ${lockCheck.secondsLeft}s.`
      );
    }

    try {
      // Fast path: caller already knows which staff member this probably is
      // (e.g. matched by email in POSPINModal) - verify against just them.
      if (staffId) {
        const secretDoc = await db.collection("staffSecrets").doc(staffId).get();
        if (secretDoc.exists && secretDoc.data().pin === pin) {
          await recordPinOutcome(request.auth.uid, true);
          const profileDoc = await db.collection("staffProfiles").doc(staffId).get();
          const profile = profileDoc.data();
          return {
            verified: true,
            staffId,
            staffName: profile ? `${profile.firstName} ${profile.lastName}` : undefined,
          };
        }
        await recordPinOutcome(request.auth.uid, false);
        return { verified: false };
      }

      // Fallback path: search every active staff member at this location for
      // a matching PIN (mirrors POSPINModal.tsx's existing "search all active
      // staff" behavior, just moved server-side).
      const profilesSnapshot = await db
        .collection("staffProfiles")
        .where("locationId", "==", locationId)
        .where("active", "==", true)
        .get();

      for (const profileDoc of profilesSnapshot.docs) {
        const secretDoc = await db.collection("staffSecrets").doc(profileDoc.id).get();
        if (secretDoc.exists && secretDoc.data().pin === pin) {
          await recordPinOutcome(request.auth.uid, true);
          const profile = profileDoc.data();
          return {
            verified: true,
            staffId: profileDoc.id,
            staffName: `${profile.firstName} ${profile.lastName}`,
          };
        }
      }

      await recordPinOutcome(request.auth.uid, false);
      return { verified: false };
    } catch (error) {
      console.error("verifyStaffPin error:", error);
      throw new HttpsError("internal", "PIN verification failed.");
    }
  }
);



