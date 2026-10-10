import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { MobilePageMenu } from './MobilePageMenu';
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key})}));
const page={id:'one',path:'/one',labelKey:'A full page name without truncation',icon:Phone};
function renderMenu(pages:typeof page[]){render(<MemoryRouter><MobilePageMenu title='PBX' pages={pages} currentPage={pages[0]}/></MemoryRouter>);}
describe('MobilePageMenu full page access',()=>{
 it('keeps an empty section label static',()=>{renderMenu([]);expect(screen.getByTestId('bottom-bar-section')).toHaveTextContent('PBX');expect(screen.queryByTestId('bottom-bar-section-trigger')).toBeNull();});
 it('opens even a single page with its full name and current-page state',()=>{
  renderMenu([page]);fireEvent.click(screen.getByTestId('bottom-bar-section-trigger'));
  const link=within(screen.getByTestId('bottom-bar-page-menu')).getByRole('link',{name:page.labelKey});expect(link).toHaveAttribute('href','/one');expect(link).toHaveAttribute('aria-current','page');
 });
 it('lists every page and keeps the panel open for a modified click',()=>{
  const pages=Array.from({length:12},(_,i)=>({...page,id:String(i),path:'/page-'+i,labelKey:'Full page name '+i}));renderMenu(pages);fireEvent.click(screen.getByTestId('bottom-bar-section-trigger'));
  const menu=screen.getByTestId('bottom-bar-page-menu');expect(within(menu).getAllByRole('link')).toHaveLength(12);
  fireEvent.click(within(menu).getByRole('link',{name:'Full page name 11'}),{ctrlKey:true});expect(menu).toBeInTheDocument();
 });
});
