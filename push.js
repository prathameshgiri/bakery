const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const parentReadme = fs.readFileSync('../README.md', 'utf8');
const currentReadme = fs.readFileSync('README.md', 'utf8');
fs.writeFileSync('README.md', currentReadme + '\n\n' + parentReadme);

if (!fs.existsSync('images')) {
    fs.mkdirSync('images');
}
fs.copyFileSync('../images/hero_banner.jpg', 'images/hero_banner.jpg');
fs.copyFileSync('../images/ui_mockup.jpg', 'images/ui_mockup.jpg');
fs.copyFileSync('../images/admin_dashboard.jpg', 'images/admin_dashboard.jpg');

try {
    execSync('git add .');
    execSync('git commit -m "Update README with detailed sections and design images"');
    execSync('git push origin main || git push origin master');
    console.log("Push successful");
} catch(e) {
    console.log(e.stdout ? e.stdout.toString() : '');
    console.error(e.stderr ? e.stderr.toString() : e);
}
