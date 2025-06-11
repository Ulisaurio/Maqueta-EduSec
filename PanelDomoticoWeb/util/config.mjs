import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '..', 'config.json');

const defaultConfig = { serialPort: process.env.SERIAL_PORT || 'COM5' };

export async function readConfig() {
  try {
    const data = await fs.readFile(configPath, 'utf8');
    return { ...defaultConfig, ...JSON.parse(data) };
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
      return { ...defaultConfig };
    }
    console.error('Error reading config:', err);
    return { ...defaultConfig };
  }
}

export async function writeConfig(newCfg) {
  const current = await readConfig();
  const updated = { ...current, ...newCfg };
  await fs.writeFile(configPath, JSON.stringify(updated, null, 2));
  return updated;
}
