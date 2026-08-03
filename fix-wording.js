const fs = require('fs');
const path = './src/lib/pdf-generator.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/patient/g, 'customer');
content = content.replace(/Patient/g, 'Customer');
content = content.replace(/patients/g, 'customers');
content = content.replace(/Patients/g, 'Customers');
content = content.replace(/practice/g, 'business');
content = content.replace(/Practice/g, 'Business');
content = content.replace(/"PRM"/g, '"CRM"');

fs.writeFileSync(path, content, 'utf8');
console.log('Replaced all instances of patient and practice.');
