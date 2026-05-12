const emailjs = require('@emailjs/nodejs');
const fs = require('fs');
const path = require('path');

const rotaData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../rota.json'), 'utf8')
);

const { members, startDate, gapDays, tasks } = rotaData;

const PUBLIC_KEY  = process.env.EMAILJS_PUBLIC_KEY;
const SERVICE_ID  = process.env.EMAILJS_SERVICE_ID;
const TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;

if (!PUBLIC_KEY || !SERVICE_ID || !TEMPLATE_ID) {
  console.log('EmailJS secrets not configured. Skipping.');
  process.exit(0);
}

emailjs.init({ publicKey: PUBLIC_KEY, privateKey: PUBLIC_KEY });

function toDateStr(date) { return date.toISOString().split('T')[0]; }

function getPersonForDate(targetDateStr) {
  const start = new Date(startDate);
  const target = new Date(targetDateStr);
  const diffDays = Math.round((target - start) / (1000 * 60 * 60 * 24));
  if (diffDays < 0 || diffDays % gapDays !== 0) return null;
  const idx = Math.floor(diffDays / gapDays) % members.length;
  return { ...members[idx], date: targetDateStr };
}

async function main() {
  const today = new Date();
  today.setHours(0,0,0,0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = toDateStr(tomorrow);

  console.log(`Checking rota for tomorrow: ${tomorrowStr}`);

  const person = getPersonForDate(tomorrowStr);
  if (!person) { console.log('No cleaning tomorrow.'); return; }
  console.log(`Tomorrow: ${person.name}`);

  if (!person.email) {
    console.log(`No email for ${person.name} — skipping.`);
    return;
  }

  const logFile = path.join(__dirname, '../../.sent-log.json');
  let sentLog = {};
  try { sentLog = JSON.parse(fs.readFileSync(logFile, 'utf8')); } catch(e) {}

  const logKey = `${person.name}_${tomorrowStr}`;
  if (sentLog[logKey]) {
    console.log(`Already sent to ${person.name} for ${tomorrowStr}. Skipping.`);
    return;
  }

  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
      to_name:       person.name,
      to_email:      person.email,
      cleaning_date: tomorrowStr,
      tasks:         tasks.join(', '),
      house_name:    '57 Hind Grove',
      website_url:   'https://cybergun-bit.github.io/hind-grove'
    });

    sentLog[logKey] = new Date().toISOString();
    fs.writeFileSync(logFile, JSON.stringify(sentLog, null, 2));
    console.log(`✅ Reminder sent to ${person.name}!`);
  } catch(err) {
    console.error(`❌ Failed:`, err);
    process.exit(1);
  }
}

main();
