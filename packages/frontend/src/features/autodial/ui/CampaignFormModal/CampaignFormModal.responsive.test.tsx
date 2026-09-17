import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(relative: string): string {
  return readFileSync(resolve(__dirname, relative), 'utf8');
}

describe('Autodial form modals - static shell and responsive grids', () => {
  it('pins campaign shell via size=large and a flex scroll body', () => {
    const tsx = read('./CampaignFormModal.tsx');
    const css = read('./CampaignFormModal.module.scss');
    const tabsCss = read('./CampaignTabs.module.scss');

    expect(tsx).toMatch(/size="large"/);
    expect(tsx).toMatch(/data-testid="autodial-campaign-form-body"/);
    expect(css).toMatch(/\.body[\s\S]*flex:\s*1 1 auto/);
    expect(css).toMatch(/min-height:\s*0/);
    expect(css).toMatch(/overflow-y:\s*auto/);
    expect(css).not.toMatch(/max-height:\s*min\(/);
    expect(tabsCss).toMatch(/@media \(max-width:\s*640px\)[\s\S]*grid-template-columns:\s*1fr/);
  });

  it('pins base, contact and import shells and collapses field grids at 640px', () => {
    const baseTsx = read('../BaseFormModal/BaseFormModal.tsx');
    const baseCss = read('../BaseFormModal/BaseFormModal.module.scss');
    const contactTsx = read('../ContactFormModal/ContactFormModal.tsx');
    const contactCss = read('../ContactFormModal/ContactFormModal.module.scss');
    const importTsx = read('../ImportWizard/ImportWizard.tsx');
    const importCss = read('../ImportWizard/ImportWizard.module.scss');

    expect(baseTsx).toMatch(/size="large"/);
    expect(contactTsx).toMatch(/size="large"/);
    expect(importTsx).toMatch(/size="large"/);

    expect(baseCss).toMatch(/overflow-y:\s*auto/);
    expect(baseCss).not.toMatch(/max-height:\s*min\(/);
    expect(baseCss).toMatch(/@media \(max-width:\s*640px\)[\s\S]*grid-template-columns:\s*1fr/);

    expect(contactCss).toMatch(/overflow-y:\s*auto/);
    expect(contactCss).toMatch(/\.phoneRow[\s\S]*@media \(max-width:\s*640px\)[\s\S]*flex-direction:\s*column/);
    expect(contactCss).toMatch(/\.narrow[\s\S]*@media \(max-width:\s*640px\)[\s\S]*width:\s*100%/);

    expect(importCss).toMatch(/overflow-y:\s*auto/);
    expect(importCss).toMatch(/overflow-x:\s*auto/);
  });
});
