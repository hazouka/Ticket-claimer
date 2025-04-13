const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { Client } = require('discord.js-selfbot-v13');
const notifier = require('node-notifier');
const fetch = require('node-fetch');

let mainWindow;
let client = null;
let isPaused = false;

const CLAIM_BUTTON_ID = 'persistent_claim_ticket';
const TICKET_KEYWORD = 'ticket';
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1360927177478111337/lzUJyKQuBaKPBiaa1Zykh2zfq0GxGtABJfErgsAc2SJySoT3uZbuKcL9klEf73qLs9QI';

const claimedTickets = new Set();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 500,
    frame: false,
    transparent: true,
    vibrancy: 'ultra-dark',
    hasShadow: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // Start the Discord selfbot
  client = new Client({ checkUpdate: false });
  client.login(''); // Replace with your token

  client.on('ready', () => {
    sendToRenderer('status', `Logged in as ${client.user.tag}`);
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
              sendToRenderer('log', `Claimed ticket: #${message.channel.name}`);

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
});

// Listen for window move events from the renderer
ipcMain.on('move-window', (event, deltaX, deltaY) => {
  if (mainWindow) {
    const { x, y, width, height } = mainWindow.getBounds();
    mainWindow.setBounds({
      x: x + deltaX,
      y: y + deltaY,
      width: width,
      height: height
    });
  }
});

// Other window control IPC handlers
ipcMain.on('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});
ipcMain.on('close-window', () => {
  if (mainWindow) mainWindow.close();
});
ipcMain.on('pause-toggle', (event, paused) => {
  isPaused = paused;
});

// Updated sendWebhookNotification function with embed formatting
async function sendWebhookNotification(channelName) {
  try {
    const embed = {
      title: "Ticket Claimed",
      description: `Ticket **#${channelName}** has been auto-claimed.`,
      color: 0x00d1b2, // Green accent
      timestamp: new Date().toISOString(),
      footer: {
        text: "Ticket Claimer Bot"
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

// Utility: Send data to renderer process
function sendToRenderer(channel, message) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, message);
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
