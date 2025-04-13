const { Client } = require('discord.js-selfbot-v13');
const fetch = require('node-fetch');
const notifier = require('node-notifier');

const CLAIM_BUTTON_ID = 'persistent_claim_ticket';
const TICKET_KEYWORD = 'ticket';
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1360927177478111337/lzUJyKQuBaKPBiaa1Zykh2zfq0GxGtABJfErgsAc2SJySoT3uZbuKcL9klEf73qLs9QI';
const claimedTickets = new Set();

let isPaused = false;

const client = new Client({ checkUpdate: false });
client.login('YOUR_DISCORD_TOKEN'); // Replace with your token

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (isPaused || message.channel.type !== 'GUILD_TEXT') return;
  if (!message.channel.name.toLowerCase().includes(TICKET_KEYWORD)) return;
  if (claimedTickets.has(message.channel.id)) return;

  const permissions = message.channel.permissionsFor(client.user);
  if (!permissions.has('VIEW_CHANNEL') || !permissions.has('READ_MESSAGE_HISTORY')) return;

  try {
    const messages = await message.channel.messages.fetch({ limit: 5 });
    for (const msg of messages.values()) {
      if (!msg.components?.length) continue;
      for (const row of msg.components) {
        for (const component of row.components) {
          if (component.customId === CLAIM_BUTTON_ID) {
            await msg.clickButton(component.customId);
            claimedTickets.add(message.channel.id);
            console.log(`Claimed ticket: #${message.channel.name}`);
            await sendWebhookNotification(message.channel.name);
            notifier.notify({
              title: 'Ticket Claimed',
              message: `Ticket #${message.channel.name} claimed!`
            });
            return;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error during ticket claim:', err);
  }
});

async function sendWebhookNotification(channelName) {
  try {
    const embed = {
      title: "Ticket Claimed",
      description: `Ticket **#${channelName}** has been auto-claimed.`,
      color: 0x00d1b2, // Green accent in hexadecimal
      timestamp: new Date().toISOString(),
      footer: {
        text: "Ticket Claimer Bot",
      }
    };

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });

    if (!response.ok) {
      console.log(`Failed to send webhook: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error sending webhook:', error);
  }
}

// You can toggle the pause state by calling this function from your phone if you want.
function togglePause() {
  isPaused = !isPaused;
  console.log(`Paused: ${isPaused}`);
}

// Example of how to manually call togglePause() (you can trigger this via other methods as needed):
// togglePause();
