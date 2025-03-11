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
    
    /*
    const users = await app.client.users.list({ token: SLACK_BOT_TOKEN });
    const members = users.members.filter(u =>
      !u.is_bot && !u.deleted && u.id !== 'USLACKBOT'
    );
  */

    const members = ("U08C80UHGLE", "U086U5M4F88");
    for (const user of members) {
      try {
        const dm = await app.client.conversations.open({ users: user.id });
  
        const result = await app.client.chat.postMessage({
          channel: user,
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
                  text: "Start Weekly Check In ",
                  emoji: true
                },
                url: "https://slack.com/shortcuts/Ft08GUEQJXUM/f02c515fa6712d8cf2212ded9cabde67"
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
            console.log(`🗑️ Deleted message sent to ${user.id}`);
          } catch (err) {
            console.error("❌ Failed to delete message:", err);
          }
        }, 60 * 60 * 1000);
  
        console.log(`✅ Check-in message sent to ${user.id}`);
      } catch (error) {
        console.error(`❌ Failed to send DM to ${user.id}:`, error.message);
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

  // 🕒 Weekly scheduler (Every Friday at 6pm)
  //cron.schedule('0 18 * * 5', () => {
    //console.log('📅 Weekly check-in triggered (Friday 6PM)...');
    //sendCheckInDMs();
  //});  
  
})();
