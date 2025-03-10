const { App, ExpressReceiver } = require('@slack/bolt');
const express = require('express');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const cron = require('node-cron');

// Load secrets from GCP Secret Manager
const secretClient = new SecretManagerServiceClient();

async function getSecret(secretName) {
  const [version] = await secretClient.accessSecretVersion({
    name: `projects/check-in-bot-453300/secrets/${secretName}/versions/latest`
  });
  return version.payload.data.toString('utf8');
}

// Main function to bootstrap secrets and app
(async () => {
  const SLACK_BOT_TOKEN = await getSecret('bot-token');
  const SLACK_SIGNING_SECRET = await getSecret('client-signing-secret');

  const receiver = new ExpressReceiver({
    signingSecret: SLACK_SIGNING_SECRET,
    endpoints: '/slack/events',
  });

  const app = new App({
    token: SLACK_BOT_TOKEN,
    signingSecret: SLACK_SIGNING_SECRET,
    receiver,
  });


  async function sendHealthCheckDM() {
    try {
      const YOUR_SLACK_USER_ID = 'U08C80UHGLE'; // <-- replace with your Slack User ID
      await app.client.chat.postMessage({
        channel: YOUR_SLACK_USER_ID,
        text: "✅ Bot is running and ready to check in with members!"
      });
      console.log('✅ Sent health check DM to admin.');
    } catch (error) {
      console.error('❌ Failed to send health check DM:', error);
    }
  }

  // Mass DM logic
  async function sendCheckInDMs() {
    try {
      const users = await app.client.users.list({ token: SLACK_BOT_TOKEN });
      const members = users.members.filter(u =>
        !u.is_bot && !u.deleted && u.id !== 'USLACKBOT'
      );

      for (const user of members) {
        try {
          await app.client.chat.postMessage({
            channel: user.id,
            text: "👋 Hey! Just checking in to confirm you're still active in the organization.",
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: "👋 Hey! Just checking in to confirm you're still active in the organization."
                }
              },
              {
                type: "actions",
                elements: [
                  {
                    type: "button",
                    text: {
                      type: "plain_text",
                      text: "✅ I'm still active"
                    },
                    style: "primary",
                    value: user.id,
                    action_id: "confirm_active"
                  }
                ]
              }
            ]
          });
        } catch (err) {
          console.error(`❌ DM to ${user.name} failed:`, err.message);
        }
      }
    } catch (error) {
      console.error("❌ Failed to send check-ins:", error);
    }
  }

  // Handle button click
  app.action('confirm_active', async ({ ack, body, client }) => {
    await ack();
    const userId = body.user.id;
    console.log(`✅ ${userId} confirmed they're active.`);

    await client.chat.postMessage({
      channel: userId,
      text: "Thanks for confirming! 🙌"
    });
  });

  // Optional: Health check route
  const expressApp = express();
  expressApp.get('/', (req, res) => res.send('Slack bot is running 🚀'));
  expressApp.use('/slack/events', receiver.app);

  // Start Express server
  const PORT = process.env.PORT || 8080;
  expressApp.listen(PORT, () => {
    console.log(`⚡️ App running on port ${PORT}`);
    sendHealthCheckDM();
  });

  // 🕒 Weekly scheduler (Every Monday at 9am)
  cron.schedule('0 9 * * 1', () => {
    console.log('📅 Weekly check-in triggered...');
    sendCheckInDMs();
  });

})();
