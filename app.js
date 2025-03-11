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
    processBeforeResponse: true // 🔥 This is the missing piece
  });

  const app = new App({
    token: SLACK_BOT_TOKEN,
    signingSecret: SLACK_SIGNING_SECRET,
    receiver,
  });

  // Mass DM logic
  async function sendCheckInDMs() {
    const members = ["U08C80UHGLE"];
    for (const userId of members) {
      try {
        const dm = await app.client.conversations.open({ users: userId });
        await app.client.chat.postMessage({
          channel: dm.channel.id,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "Please click the button."
              },
              accessory: {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Start Weekly Check In"
                },
                action_id: "start_checkin_click"
              }
            }
          ]
        });
        console.log(`✅ Check-in message sent to ${userId}`);
      } catch (error) {
        console.error(`❌ Failed to send DM to ${userId}:`, error.message);
      }
    }
  }

  app.action('start_checkin_click', async ({ ack, body, client }) => {
    await ack();
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'checkin_form',
        title: { type: 'plain_text', text: 'Weekly Check-In' },
        submit: { type: 'plain_text', text: 'Submit' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          {
            type: 'input',
            block_id: 'task_1',
            label: { type: 'plain_text', text: 'What’s one thing you did this week?' },
            element: { type: 'plain_text_input', action_id: 'response' }
          },
          {
            type: 'input',
            block_id: 'task_2',
            label: { type: 'plain_text', text: 'Another contribution?' },
            element: { type: 'plain_text_input', action_id: 'response' }
          },
          {
            type: 'input',
            block_id: 'task_3',
            label: { type: 'plain_text', text: 'One more thing?' },
            element: { type: 'plain_text_input', action_id: 'response' }
          }
        ]
      }
    });
  });

  // Express server setup
  const expressApp = express();
  expressApp.get('/', (req, res) => res.send('Slack bot is running 🚀'));
  expressApp.use('/slack/events', receiver.app);

  // Start Express server
  const PORT = process.env.PORT || 8080;
  expressApp.listen(PORT, () => {
    console.log(`⚡️ App running on port ${PORT}`);
    sendCheckInDMs(); // You can comment this out if you only want scheduled sends
  });

})();
