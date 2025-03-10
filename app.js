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
    const workflowUrl = "https://slack.com/shortcuts/Ft08GUEQJXUM/f02c515fa6712d8cf2212ded9cabde67"; // Replace this with your real Workflow link trigger URL
  
    // Replace with your user ID and one other test user
    const testUserIds = [
      'U08C80UHGLE', // Your Slack User ID
    ];
  
    for (const userId of testUserIds) {
      try {
        const dm = await app.client.conversations.open({ users: userId });
  
        const result = await app.client.chat.postMessage({
          channel: dm.channel.id,
          "blocks": [
            {
              "type": "section",
              "text": {
                "type": "mrkdwn",
                "text": "👋 Hey! It's time for your weekly check-in. Please click the button."
              },
              "accessory": {
                "type": "button",
                "text": {
                  "type": "plain_text",
                  "text": "Click Here",
                  "emoji": true
                },
                "value": "click_me_123",
                "url": "https://slack.com/shortcuts/Ft08GUEQJXUM/f02c515fa6712d8cf2212ded9cabde67"
              }
            }
          ]
        });

        // Schedule delete after 60 seconds (for testing)
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
        }, 60 * 1000);
  
        console.log(`✅ Check-in message sent to ${userId}`);
      } catch (error) {
        console.error(`❌ Failed to send DM to ${userId}:`, error.message);
      }
    }
  }
  

  // Optional: Health check route
  const expressApp = express();
  expressApp.get('/', (req, res) => res.send('Slack bot is running 🚀'));
  expressApp.use('/slack/events', receiver.app);
  expressApp.post("/slack/events", express.json(), (req, res, next) => {
    if (req.body && req.body.type === "url_verification") {
      console.log("✅ Slack challenge verification received");
      return res.status(200).send(req.body.challenge);
    }
    next();
  });

  // Start Express server
  const PORT = process.env.PORT || 8080;
  expressApp.listen(PORT, () => {
    console.log(`⚡️ App running on port ${PORT}`);
    sendHealthCheckDM();
    sendCheckInDMs();
  });

  // 🕒 Weekly scheduler (Every Monday at 9am)

  /*
  cron.schedule('0 9 * * 1', () => {
    console.log('📅 Weekly check-in triggered...');
    sendCheckInDMs();
  });
  */

  
})();
