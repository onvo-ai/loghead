const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const packagesDir = path.join(__dirname, '../packages');
const packages = fs.readdirSync(packagesDir).filter(p => fs.statSync(path.join(packagesDir, p)).isDirectory());

console.log("Building all packages...");

for (const pkg of packages) {
    if (pkg === 'browser') continue; // Skip browser package as it's an extension
    console.log(`\n>>> Building ${pkg}...`);
    const pkgDir = path.join(packagesDir, pkg);
    try {
        execSync('npm install', { cwd: pkgDir, stdio: 'inherit' });
        execSync('npm run build', { cwd: pkgDir, stdio: 'inherit' });
    } catch (e) {
        console.error(`Failed to build ${pkg}`);
        process.exit(1);
    }
}
console.log("\nAll packages built successfully.");
