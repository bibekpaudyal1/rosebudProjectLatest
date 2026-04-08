const fs = require('fs');
const path = require('path');

function splitFile(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const rawBlocks = content.split('// ============================================================');
  
  for (let block of rawBlocks) {
    if (!block.trim()) continue;
    
    const lines = block.trim().split('\n');
    let targetPath = filepath; // Default to original file if no path found
    
    // Look for path in first few lines
    for (let i = 0; i < 5; i++) {
        const line = lines[i];
        if (!line) continue;
        if (line.includes('apps/mobile/')) {
            const match = line.match(/apps\/mobile\/[^\s]+/);
            if (match) {
                targetPath = match[0];
                break;
            }
        } else if (line.includes('eas.json')) {
            targetPath = 'apps/mobile/eas.json';
            break;
        }
    }
    
    console.log('Writing to ' + targetPath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, '// ============================================================\n' + block);
  }
}

splitFile('apps/mobile/components/ProductCard.tsx');
splitFile('apps/mobile/app/(auth)/login.tsx');
splitFile('apps/mobile/app/(tabs)/orders.tsx');
splitFile('apps/mobile/app/(tabs)/search.tsx');
