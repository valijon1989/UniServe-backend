export async function sendEmail(to: string, subject: string, text: string) {
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    console.info(`[sendEmail][dev] to=${to} subject=${subject}`);
    console.info(text);
  }
}
