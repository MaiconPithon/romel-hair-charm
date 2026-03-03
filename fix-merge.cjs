const fs = require('fs');
const path = require('path');

const files = [
    'src/pages/Agendar.tsx',
    'src/pages/Admin.tsx',
    'src/pages/Index.tsx',
    'src/pages/AdminLogin.tsx'
];

files.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) return;

    let content = fs.readFileSync(filePath, 'utf8');

    // Replace:
    // <<<<<<< HEAD
    // [HEAD content]
    // =======
    // [incoming content]
    // >>>>>>> 73eb7f5 (Ajuste de branding e logo)

    content = content.replace(/<<<<<<< HEAD\r?\n([\s\S]*?)=======\r?\n[\s\S]*?>>>>>>> [^\n]+\r?\n/g, '\$1');

    fs.writeFileSync(filePath, content);
    console.log('Fixed', file);
});
