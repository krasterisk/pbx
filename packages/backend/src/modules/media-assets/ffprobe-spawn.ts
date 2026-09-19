import { spawn } from 'node:child_process';

/** Argument-array spawn only; never a shell. Path must already be storage-root resolved. */
export function ffprobeArgs(file: string): string[] {
  return ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', '-i', file];
}

export function spawnFfprobe(file: string, timeoutMs = 5000): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffprobe', ffprobeArgs(file), { shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(Object.assign(new Error('ffprobe walltime exceeded'), { code: 'probe_timeout' }));
    }, timeoutMs);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout: stdout || stderr });
    });
  });
}
