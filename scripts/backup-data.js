const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const STORAGE_DIR = process.env.STORAGE_DIR ? path.resolve(process.env.STORAGE_DIR) : ROOT;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(STORAGE_DIR, 'data');
const UPLOAD_ROOT = process.env.UPLOAD_ROOT ? path.resolve(process.env.UPLOAD_ROOT) : path.join(STORAGE_DIR, 'uploads');
const BACKUP_ROOT = process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.join(STORAGE_DIR, 'backups');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = path.join(BACKUP_ROOT, stamp);

fs.mkdirSync(target, { recursive: true });

for (const name of ['decolores.sqlite', 'decolores.sqlite-wal', 'decolores.sqlite-shm']) {
    const dbPath = path.join(DATA_DIR, name);
    if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, path.join(target, name));
    }
}

const uploadsTarget = path.join(target, 'uploads');
if (fs.existsSync(UPLOAD_ROOT)) {
    fs.cpSync(UPLOAD_ROOT, uploadsTarget, { recursive: true });
}

console.log(`Backup creado en ${target}`);
