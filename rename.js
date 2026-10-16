const fs = require('fs');
const files = [
  'src/store/useProblemStore.ts',
  'src/app/page.tsx',
  'src/app/layout.tsx',
  'src/app/sign-in/[[...sign-in]]/page.tsx',
  'src/app/sign-up/[[...sign-up]]/page.tsx',
  'package.json',
  'README.md',
  'src/app/problem/[id]/page.tsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/CodeMorph/g, 'CodeLaunch');
    content = content.replace(/codemorph/g, 'codelaunch');
    fs.writeFileSync(file, content);
  }
});
