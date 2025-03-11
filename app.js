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

  // 👇 BUTTON HANDLER TO OPEN MODAL
  app.action('start_checkin_click', async ({ ack, body, client }) => {
    await ack();
    console.log(`✅ Received button click from user: ${body.user.id}`);

    try {
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
    } catch (err) {
      console.error("❌ Failed to open modal:", err.data || err.message);
    }
  });

  // 👇 HANDLE FORM SUBMISSION
  app.view('checkin_form', async ({ ack, body, view, client }) => {
    await ack();
    const user = body.user.id;

    const response1 = view.state.values.task_1.response.value;
    const response2 = view.state.values.task_2.response.value;
    const response3 = view.state.values.task_3.response.value;

    console.log(`✅ ${user} submitted:`, { response1, response2, response3 });

    await client.chat.postMessage({
      channel: user,
      text: `✅ Thanks for submitting your weekly check-in! 🙌\n• ${response1}\n• ${response2}\n• ${response3}`
    });
  });

  // 👇 DM MESSAGE WITH BUTTON
  async function sendCheckInDMs() {
    const members = ['U08C80UHGLE']; // Your test Slack user ID(s)
    for (const userId of members) {
      try {
        const dm = await app.client.conversations.open({ users: userId });

        await app.client.chat.postMessage({
          channel: dm.channel.id,
          text: "It's check-in time!",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "*It's time for your weekly check-in.* Click the button below."
              },
              accessory: {
                type: "button",
                text: { type: "plain_text", text: "Start Weekly Check In", emoji: true },
                action_id: "start_checkin_click"
              }
            }
          ]
        });

        console.log(`✅ Check-in message sent to ${userId}`);
      } catch (err) {
        console.error(`❌ Failed to send check-in message to ${userId}:`, err.message);
      }
    }
  }

  // Start express server
  const expressApp = express();
  expressApp.use('/slack/events', receiver.app);
  expressApp.get('/', (req, res) => res.send('Slack bot is running 🚀'));

  const PORT = process.env.PORT || 8080;
  expressApp.listen(PORT, () => {
    console.log(`⚡️ App running on port ${PORT}`);
    sendCheckInDMs(); // Send once on startup
  });

})();
