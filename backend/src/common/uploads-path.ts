import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export function getBackendRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(dir, 'package.json'))) {
      return dir;
    }
    dir = join(dir, '..');
  }
  return process.cwd();
}

export function getUploadsPath(): string {
  const uploadsPath = join(getBackendRoot(), 'uploads');
  if (!existsSync(uploadsPath)) {
    mkdirSync(uploadsPath, { recursive: true });
  }
  return uploadsPath;
}
