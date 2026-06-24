import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log("=========================================");
console.log("   Generated Web Push VAPID Keys");
console.log("=========================================");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("=========================================");
console.log("Save these to your packages/api/.env and apps/web/.env files!");
