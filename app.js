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

  async function sendHealthCheckDM() {
    try {
      const YOUR_SLACK_USER_ID = 'U08C80UHGLE';
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
    const members = ["U08C80UHGLE"];

    for (const userId of members) {
      try {
        const dm = await app.client.conversations.open({ users: userId });

        const result = await app.client.chat.postMessage({
          channel: dm.channel.id,
          blocks: [
            {
              type: "section",
              text: {
                type: "plain_text",
                text: "👋 Hey! Please fill out this weekly progress check. You will receive these every Friday and have 48 hours to respond."
              }
            },
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
                  text: "Start Weekly Check In",
                  emoji: true
                },
                url: "https://slack.com/shortcuts/Ft08GUEQJXUM/f02c515fa6712d8cf2212ded9cabde67",
                action_id: "start_checkin_click"
              }
            }
          ]
        });

        // Schedule delete after 48 hours
        setTimeout(async () => {
          try {
            await app.client.chat.delete({
              channel: result.channel,
              ts: result.ts
            });
            console.log(`🗑️ Deleted message sent to ${userId}`);
          } catch (err) {
            console.error("❌ Failed to delete message:", err);
          }
        }, 48 * 60 * 60 * 1000); // 48 hours in milliseconds

        console.log(`✅ Check-in message sent to ${userId}`);
      } catch (error) {
        console.error(`❌ Failed to send DM to ${userId}:`, error.message);
      }
    }
  }

  app.action('start_checkin_click', async ({ ack }) => {
    await ack(); // acknowledge the click, nothing else needed
  });

  // Express server setup
  const expressApp = express();
  expressApp.get('/', (req, res) => res.send('Slack bot is running 🚀'));
  expressApp.use('/slack/events', receiver.app);

  // Start Express server
  const PORT = process.env.PORT || 8080;
  expressApp.listen(PORT, () => {
    console.log(`⚡️ App running on port ${PORT}`);
    sendHealthCheckDM();
    sendCheckInDMs(); // You can comment this out if you only want scheduled sends
  });

  // 🕒 Weekly scheduler (Every Friday at 6pm)
  /*
  cron.schedule('0 18 * * 5', () => {
    console.log('📅 Weekly check-in triggered (Friday 6PM)...');
    sendCheckInDMs();
  });
  */

})();
