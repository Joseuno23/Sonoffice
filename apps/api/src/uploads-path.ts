import { basename, dirname, resolve } from 'path';

function resolveUploadsDir() {
  if (process.env.UPLOADS_DIR) return resolve(process.env.UPLOADS_DIR);

  const cwd = process.cwd();
  const runningFromApiWorkspace = basename(cwd) === 'api' && basename(dirname(cwd)) === 'apps';

  return resolve(cwd, runningFromApiWorkspace ? '../../uploads' : 'uploads');
}

export const UPLOADS_DIR = resolveUploadsDir();
export const AVATARS_DIR = resolve(UPLOADS_DIR, 'avatars');
