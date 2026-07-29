const fs = require('fs');
const pdf = require('pdf-parse');
let dataBuffer = fs.readFileSync("/home/nithu/Downloads/report-Tribeca Dental Care - AI Growth Readiness Report.pdf");
pdf(dataBuffer).then(function(data) { console.log(data.text); }).catch(e => console.log(e));
