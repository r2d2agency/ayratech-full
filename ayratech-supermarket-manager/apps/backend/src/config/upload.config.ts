import * as path from 'path';
import * as fs from 'fs';

let uploadRoot = process.env.UPLOAD_DIR;

if (!uploadRoot) {
  const cwd = process.cwd();
  
  // Check if we are already inside apps/backend (e.g. running from that dir)
  // We check for src/main.ts to be sure it's a nest app root
  if (cwd.endsWith('backend') && fs.existsSync(path.join(cwd, 'src', 'main.ts'))) {
     uploadRoot = path.join(cwd, 'uploads');
  } else {
     // We are likely in the monorepo root
     const appsBackendPath = path.join(cwd, 'apps', 'backend');
     if (fs.existsSync(appsBackendPath)) {
        uploadRoot = path.join(appsBackendPath, 'uploads');
     } else {
        // Fallback to local uploads folder
        uploadRoot = path.join(cwd, 'uploads');
     }
  }
}

// Ensure the directory exists
if (!fs.existsSync(uploadRoot)) {
    try {
        fs.mkdirSync(uploadRoot, { recursive: true });
    } catch (error) {
        console.error(`[Config] Failed to create upload directory at ${uploadRoot}:`, error);
    }
}

console.log(`[Config] UPLOAD_ROOT resolved to: ${uploadRoot}`);
console.log(`[Config] CWD: ${process.cwd()}`);

export const UPLOAD_ROOT = uploadRoot;
