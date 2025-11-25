const { PostHog } = require('posthog-node');
require('dotenv').config();

console.log('🧪 Testing PostHog Connection...\n');
console.log('Configuration:');
console.log('  POSTHOG_ENABLED:', process.env.POSTHOG_ENABLED);
console.log('  POSTHOG_API_KEY:', process.env.POSTHOG_API_KEY?.substring(0, 15) + '...');
console.log('  POSTHOG_HOST:', process.env.POSTHOG_HOST);
console.log('');

if (process.env.POSTHOG_ENABLED !== 'true') {
  console.error('❌ PostHog is disabled. Set POSTHOG_ENABLED=true in .env');
  process.exit(1);
}

const client = new PostHog(process.env.POSTHOG_API_KEY, {
  host: process.env.POSTHOG_HOST,
  flushAt: 1,
  flushInterval: 1000,
});

console.log('✅ PostHog client created');
console.log('📤 Sending test event...');

client.capture({
  distinctId: 'test-user-' + Date.now(),
  event: 'test_event',
  properties: {
    test: true,
    timestamp: new Date().toISOString(),
    source: 'test-script',
  },
});

console.log('✅ Test event sent');
console.log('⏳ Waiting for flush...');

setTimeout(async () => {
  console.log('🔄 Shutting down client...');
  await client.shutdown();
  console.log('✅ Done!');
  console.log('');
  console.log('👉 Check your PostHog dashboard:');
  console.log('   https://us.i.posthog.com/events');
  console.log('');
  console.log('Look for the "test_event" event with test=true property');
}, 3000);

