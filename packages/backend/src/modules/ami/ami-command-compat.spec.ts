import { AmiService } from './ami.service';

describe('AMI CLI response compatibility', () => {
  function service(error: unknown, response?: unknown) {
    const value = Object.create(AmiService.prototype) as AmiService;
    Object.assign(value, { connected: true, ami: { action: (_action: unknown, callback: (err: unknown, res: unknown) => void) => callback(error, response) } });
    return value;
  }
  it.each(['Follows', 'follows'])('accepts legacy CLI %s from the manager error slot', async (response) => {
    const reply = { response, output: ['Dialplan reloaded.'] };
    await expect(service(reply).command('dialplan reload')).resolves.toEqual(reply);
  });
  it('retains the modern Success response', async () => {
    const reply = { response: 'Success', output: ['Dialplan reloaded.'] };
    await expect(service(null, reply).command('dialplan reload')).resolves.toEqual(reply);
  });
  it('uses the actual reply when the library supplies a string error alongside a valid CLI packet', async () => {
    const reply = { response: 'Follows', content: 'Command output follows\nDialplan reloaded.' };
    await expect(service('Command output follows', reply).command('dialplan reload')).resolves.toEqual(reply);
    await expect(service('Permission denied', { response: 'Error' }).command('dialplan reload')).rejects.toEqual({ response: 'Error' });
  });
  it('does not accept Follows for unrelated mutations', async () => {
    const reply = { response: 'Follows' };
    await expect(service(reply).action({ action: 'UpdateConfig' })).rejects.toEqual(reply);
  });
  it('rejects an explicit AMI error in either callback position', async () => {
    const reply = { response: 'Error', message: 'Permission denied' };
    await expect(service(reply).command('dialplan reload')).rejects.toEqual(reply);
    await expect(service(null, reply).command('dialplan reload')).rejects.toEqual(reply);
  });
});
