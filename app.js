const { App, ExpressReceiver } = require('@slack/bolt');
const express = require('express');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

// GCP Secret Manager setup
const secretClient = new SecretManagerServiceClient();
async function getSecret(secretName) {
  const [version] = await secretClient.accessSecretVersion({
    name: `projects/check-in-bot-453300/secrets/${secretName}/versions/latest`
  });
  return version.payload.data.toString('utf8');
}

(async () => {
  const SLACK_BOT_TOKEN = await getSecret('bot-token');
  const SLACK_SIGNING_SECRET = await getSecret('client-signing-secret');

  const receiver = new ExpressReceiver({
    signingSecret: SLACK_SIGNING_SECRET,
    processBeforeResponse: true,
    endpoints: '/slack/events'
  });

  const app = new App({
    token: SLACK_BOT_TOKEN,
    signingSecret: SLACK_SIGNING_SECRET,
    receiver
  });

  // 🔘 Handle button click → open modal
  app.action('open_modal_button', async ({ ack, body, client }) => {
    await ack();
    console.log(`✅ Button clicked by user: ${body.user.id}`);

    try {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal',
          title: { type: 'plain_text', text: 'Hello Modal' },
          close: { type: 'plain_text', text: 'Close' },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '👋 This is a minimal test modal!'
              }
            }
          ]
        }
      });
    } catch (err) {
      console.error("❌ Failed to open modal:", err.data || err.message);
    }
  });

  // 📤 Send initial DM with button
  async function sendTestDM() {
    const userIds = ['U08C80UHGLE']; // Replace with your test user ID(s)

    for (const userId of userIds) {
      try {
        const dm = await app.client.conversations.open({ users: userId });

        await app.client.chat.postMessage({
          channel: dm.channel.id,
          text: 'Click the button below to open a modal.',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Test Modal Trigger:* Click the button below.'
              },
              accessory: {
                type: 'button',
                text: { type: 'plain_text', text: 'Open Modal' },
                action_id: 'open_modal_button'
              }
            }
          ]
        });

        console.log(`✅ Sent test DM to ${userId}`);
      } catch (err) {
        console.error(`❌ Failed to send DM to ${userId}:`, err.message);
      }
    }
  }

  // 🌐 Start express server for Cloud Run
  const expressApp = express();
  expressApp.use('/', receiver.app); // mount root — don't double prefix

  expressApp.get('/', (req, res) => res.send('Slack bot is running 🚀'));

  const PORT = process.env.PORT || 8080;
  expressApp.listen(PORT, () => {
    console.log(`⚡️ App running on port ${PORT}`);
    sendTestDM(); // Send DM on startup for test
  });

})();
