type RecoveryMailPayload = {
  to: string;
  subject: string;
  body: string;
};

const shouldLogRecovery = process.env.AUTH_DEBUG_RECOVERY !== "false";
const isProd = process.env.NODE_ENV === "production";
const shouldOutput = isProd ? process.env.AUTH_DEBUG_RECOVERY === "true" : shouldLogRecovery;
const recoveryWebhookUrl = process.env.RECOVERY_WEBHOOK_URL;

export async function sendRecoveryMail(payload: RecoveryMailPayload) {
  if (recoveryWebhookUrl) {
    try {
      await fetch(recoveryWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      return;
    } catch (err) {
      console.error("recovery webhook send failed", err);
    }
  }

  if (shouldOutput) {
    console.info(`[auth-recovery][dry-run] to=${payload.to} subject=${payload.subject}`);
    console.info(payload.body);
  }
}
