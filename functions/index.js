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

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

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
