const fs = require('fs');
const pdf = require('pdf-parse');
let dataBuffer = fs.readFileSync("/home/nithu/Music/lead/Robointech_AI_Growth_Readiness_Report_Template.pdf");
pdf(dataBuffer).then(function(data) { console.log(data.text); }).catch(e => console.log(e));
