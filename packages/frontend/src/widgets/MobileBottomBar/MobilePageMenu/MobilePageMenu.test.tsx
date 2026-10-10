import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { MobilePageMenu } from './MobilePageMenu';
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key})}));
const page={id:'one',path:'/one',labelKey:'A full page name without truncation',icon:Phone};
function renderMenu(pages:typeof page[]){render(<MemoryRouter><MobilePageMenu title='PBX' pages={pages} currentPage={pages[0]}/></MemoryRouter>);}
describe('MobilePageMenu full page access',()=>{
 it('keeps an empty section label static',()=>{renderMenu([]);expect(screen.getByTestId('bottom-bar-section')).toHaveTextContent('PBX');expect(screen.queryByTestId('bottom-bar-section-trigger')).toBeNull();});
 it('keeps a single-page section static without a trigger or duplicate link',()=>{
  renderMenu([page]);expect(screen.getByTestId('bottom-bar-section')).toHaveTextContent('PBX');
  expect(screen.queryByTestId('bottom-bar-section-trigger')).toBeNull();
  expect(screen.queryByRole('link')).toBeNull();expect(screen.queryByRole('dialog')).toBeNull();
 });
 it('uses only the section name as heading and initially focuses it instead of Close', async () => {
  renderMenu([page,{...page,id:'two',path:'/two'}]);fireEvent.click(screen.getByTestId('bottom-bar-section-trigger'));
  const menu=screen.getByTestId('bottom-bar-page-menu');
  const heading=within(menu).getByRole('heading',{name:'PBX'});
  expect(heading).toHaveTextContent(/^PBX$/);
  await waitFor(()=>expect(heading).toHaveFocus());
  expect(within(menu).getByRole('button',{name:'common.close'})).not.toHaveFocus();
  fireEvent.keyDown(menu,{key:'Escape'});
  await waitFor(()=>expect(screen.queryByTestId('bottom-bar-page-menu')).toBeNull());
  await waitFor(()=>expect(screen.getByTestId('bottom-bar-section-trigger')).toHaveFocus());
 });
 it('lists every page and keeps the panel open for a modified click',()=>{
  const pages=Array.from({length:12},(_,i)=>({...page,id:String(i),path:'/page-'+i,labelKey:'Full page name '+i}));renderMenu(pages);fireEvent.click(screen.getByTestId('bottom-bar-section-trigger'));
  const menu=screen.getByTestId('bottom-bar-page-menu');expect(within(menu).getAllByRole('link')).toHaveLength(12);
  fireEvent.click(within(menu).getByRole('link',{name:'Full page name 11'}),{ctrlKey:true});expect(menu).toBeInTheDocument();
 });
});
