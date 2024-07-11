const path = require('path');
const fs = require('fs');

const modulesToRun = process.argv.slice(2);
modulesToRun.forEach(moduleName => {
    const modulePath = path.resolve(__dirname, 'modules', `${moduleName}/${moduleName}.module.js`);

    if (fs.existsSync(modulePath)) {
        console.log(`Executing ${moduleName}`);
        require(modulePath)
    } else {
        console.error(`Module ${moduleName} not found at ${modulePath}`);
    }
})