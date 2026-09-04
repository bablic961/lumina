/**
 * Web Push fan-out. Without VAPID keys in .env this is a no-op, so the app
 * still runs — notifications simply stay in-app until keys are provided
 * (`npx web-push generate-vapid-keys`).
 */
const webpush = require('web-push');

let configured = false;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@lumina.local',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  configured = true;
}

async function sendPushToUser(prisma, userId, payload) {
  if (!configured) return { skipped: true };
  const devices = await prisma.device.findMany({
    where: { userId, pushEndpoint: { not: null } },
  });
  const body = JSON.stringify(payload);

  await Promise.all(
    devices.map(async (device) => {
      try {
        await webpush.sendNotification(
          { endpoint: device.pushEndpoint, keys: JSON.parse(device.pushKeys || '{}') },
          body,
        );
      } catch (err) {
        // 404/410 means the subscription died with the browser profile.
        if (err.statusCode === 404 || err.statusCode === 410) {
          await prisma.device.update({
            where: { id: device.id },
            data: { pushEndpoint: null, pushKeys: null },
          });
        }
      }
    }),
  );
  return { sent: devices.length };
}

module.exports = { sendPushToUser, pushConfigured: configured };
