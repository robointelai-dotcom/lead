const fs = require('fs');

const files = [
  './src/lib/pdf-generator.ts',
  './src/app/(dashboard)/email-campaigns/actions.ts',
  './src/app/(dashboard)/email-campaigns/new/NewEmailCampaignClient.tsx',
  './src/app/(dashboard)/automations/AutomationsClient.tsx'
];

for (const path of files) {
  let content = fs.readFileSync(path, 'utf8');

  content = content.replace(/patient/gi, 'customer');
  content = content.replace(/patients/gi, 'customers');
  content = content.replace(/practice/gi, 'business');
  content = content.replace(/practices/gi, 'businesses');
  content = content.replace(/PATIENTS/g, 'CUSTOMERS');
  content = content.replace(/PracticeName/g, 'BusinessName');

  fs.writeFileSync(path, content, 'utf8');
}

console.log('Replaced all instances in entire codebase.');
