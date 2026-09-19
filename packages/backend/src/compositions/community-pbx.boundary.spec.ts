import * as fs from 'fs';
import * as path from 'path';

describe('community-pbx compile-time boundary', () => {
  const src = (relative: string) => fs.readFileSync(path.join(__dirname, relative), 'utf8');

  it('does not import commercial AI product modules or AppModule', () => {
    const community = src('./community-pbx.module.ts') + src('./pbx-core.composition.ts');
    expect(community).not.toMatch(/AiAgentsModule/);
    expect(community).not.toMatch(/commercial-ai\.composition/);
    expect(community).not.toMatch(/from ['"]\.\.\/app\.module['"]/);
    expect(community).not.toMatch(/ai-agents\/ai-agents\.module/);
  });

  it('keeps the commercial product graph in a separate composition used only by full-pbx', () => {
    const commercial = src('./commercial-ai.composition.ts');
    expect(commercial).toMatch(/AiAgentsModule/);
    const app = fs.readFileSync(path.join(__dirname, '../app.module.ts'), 'utf8');
    expect(app).toMatch(/COMMERCIAL_AI_NEST_MODULES/);
    expect(app).toMatch(/createPbxRuntimeImports/);
  });
});
