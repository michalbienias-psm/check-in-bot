// slack-bot.js
const { App, ExpressReceiver } = require('@slack/bolt');
const express = require('express');

// Replace these with your real secrets or use env vars
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

// Slack Receiver (HTTP mode)
const receiver = new ExpressReceiver({
  signingSecret: SLACK_SIGNING_SECRET,
  processBeforeResponse: true,
  endpoints: '/slack/events'
});

// Slack Bolt App
const app = new App({
  token: SLACK_BOT_TOKEN,
  receiver,
});

// 🔘 Handle button click → open modal
app.action('open_modal_button', async ({ ack, body, client }) => {
  await ack(); // acknowledge first

  console.log('✅ Button clicked by:', body.user.id);

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
            text: { type: 'mrkdwn', text: '👋 Hello! This is a minimal modal.' }
          }
        ]
      }
    });
  } catch (err) {
    console.error('❌ Failed to open modal:', err.data || err.message);
  }
});

// 💬 DM user with a button
async function sendButtonDM(userId) {
  try {
    const dm = await app.client.conversations.open({ users: userId });

    await app.client.chat.postMessage({
      channel: dm.channel.id,
      text: 'Click the button below to open a modal',
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '*Click the button to open a modal!*' },
          accessory: {
            type: 'button',
            text: { type: 'plain_text', text: 'Open Modal' },
            action_id: 'open_modal_button'
          }
        }
      ]
    });

    console.log(`✅ Sent DM to ${userId}`);
  } catch (err) {
    console.error(`❌ Failed to send DM:`, err.message);
  }
}

// ⚡ Express server
const expressApp = express();
expressApp.use('/', receiver.app);

expressApp.get('/', (req, res) => res.send('Slack bot running 🚀'));

const PORT = process.env.PORT || 8080;
expressApp.listen(PORT, () => {
  console.log(`⚡ Server running on http://localhost:${PORT}`);
  // Test user ID here (replace with your Slack user ID)
  sendButtonDM('U1234567890'); // ← change this
});
