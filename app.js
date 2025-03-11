const { App, ExpressReceiver } = require('@slack/bolt');
const express = require('express');

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

const receiver = new ExpressReceiver({
  signingSecret: SLACK_SIGNING_SECRET,
  processBeforeResponse: true,
  endpoints: '/slack/events',
});

const app = new App({
  token: SLACK_BOT_TOKEN,
  receiver,
});

// Handle the button click (interaction)
app.action('test_button', async ({ ack, body }) => {
  console.log("✅ Button clicked by:", body.user.id);
  await ack();
});

// Send test message
async function sendTestMessage() {
  const dm = await app.client.conversations.open({ users: 'U08C80UHGLE' }); // <-- your Slack ID
  await app.client.chat.postMessage({
    channel: dm.channel.id,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: "Test interaction: Click the button below." },
        accessory: {
          type: "button",
          text: { type: "plain_text", text: "Test Button", emoji: true },
          action_id: "test_button"
        }
      }
    ]
  });
}

const expressApp = express();
expressApp.use('/slack/events', receiver.app);
expressApp.get('/', (req, res) => res.send('Slack Test Bot Running'));

const PORT = process.env.PORT || 8080;
expressApp.listen(PORT, () => {
  console.log(`⚡️ Test app listening on port ${PORT}`);
  sendTestMessage();
});
