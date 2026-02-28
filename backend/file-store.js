import { promises as fs } from 'fs';

const writeQueues = new Map();

function enqueueWrite(filePath, task) {
  const previous = writeQueues.get(filePath) || Promise.resolve();
  const current = previous.catch(() => {}).then(task);

  writeQueues.set(filePath, current);
  current.finally(() => {
    if (writeQueues.get(filePath) === current) {
      writeQueues.delete(filePath);
    }
  });

  return current;
}

async function atomicWriteFile(filePath, content, encoding = 'utf-8') {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await fs.writeFile(tempPath, content, encoding);
  try {
    await fs.rename(tempPath, filePath);
  } catch (err) {
    await fs.unlink(tempPath).catch(() => {});
    throw err;
  }
}

export function writeJsonFileQueued(filePath, data) {
  return enqueueWrite(filePath, () => atomicWriteFile(filePath, JSON.stringify(data, null, 2), 'utf-8'));
}

export function writeTextFileQueued(filePath, text) {
  return enqueueWrite(filePath, () => atomicWriteFile(filePath, text, 'utf-8'));
}
