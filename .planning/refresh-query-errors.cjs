const fs = require('node:fs');
const path = require('node:path');
const ts = require('../node_modules/typescript');
const root = path.resolve(__dirname, '../packages/frontend/src');
const files = ['features', 'pages', 'widgets'].flatMap(dir => fs.readdirSync(path.join(root, dir), {recursive:true}).filter(file => String(file).endsWith('.tsx') && !String(file).includes('.test.')).map(file => path.join(root, dir, String(file))));
const audit = [];
const tag = node => node.openingElement.tagName.getText();
const visitAll = (node, predicate) => { const found=[]; const visit=n=>{if(predicate(n))found.push(n);ts.forEachChild(n,visit);};visit(node);return found; };
for (const file of files) {
  let source = fs.readFileSync(file,'utf8');
  let ast = ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const edits=[];
  for (const element of visitAll(ast, ts.isJsxElement)) {
    if (!['VStack','HStack','Flex','div'].includes(tag(element))) continue;
    const content = element.children.filter(n=>!ts.isJsxText(n) || n.text.trim());
    if (content.length > 3) continue;
    const text = content.find(n=>ts.isJsxElement(n) && tag(n)==='Text');
    if (!text || !/loadError|loadFailed|errorLoad|errorInsights|errorFetch/.test(text.getText())) continue;
    const meaningful = text.children.filter(n=>!ts.isJsxText(n)||n.text.trim());
    if (meaningful.length!==1 || !ts.isJsxExpression(meaningful[0]) || !meaningful[0].expression) continue;
    const buttons=visitAll(element,n=>ts.isJsxElement(n)&&tag(n)==='Button');
    if(buttons.length>1)continue;
    const button=buttons[0];
    const click=button?.openingElement.attributes.properties.find(n=>ts.isJsxAttribute(n)&&n.name.getText()==='onClick');
    const retry=click?.initializer&&ts.isJsxExpression(click.initializer)?click.initializer.expression?.getText():undefined;
    const buttonChildren=button?.children.filter(n=>!ts.isJsxText(n)||n.text.trim());
    const retryLabel=buttonChildren?.length===1&&ts.isJsxExpression(buttonChildren[0])?buttonChildren[0].expression?.getText():undefined;
    const test=element.openingElement.attributes.properties.find(n=>ts.isJsxAttribute(n)&&n.name.getText()==='data-testid')?.getText();
    edits.push({start:element.getStart(),end:element.end,value:`<QueryErrorState message={${meaningful[0].expression.getText()}}${retry?` onRetry={${retry}}`:''}${retryLabel?` retryLabel={${retryLabel}}`:''}${test?` ${test}`:''} />`});
  }
  for (const edit of edits.sort((a,b)=>b.start-a.start)) source=source.slice(0,edit.start)+edit.value+source.slice(edit.end);
  if (edits.length) {
    source=`import { QueryErrorState } from '@/shared/ui/QueryErrorState';\n`+source;
    audit.push([path.relative(root,file).replaceAll('\\','/'),`centered ${edits.length} query placeholder(s)`]);
  }
  // Primary CRUD table queries must not report a failed fetch as an empty list.
  const remainingPages = ['AiRobotsKnowledgePage', 'AiRobotsSipPage', 'AiRobotsToolsPage', 'MarketplacePage', 'ProfilePage'];
  if ((/(?:Table|List)\.tsx$/.test(file) || remainingPages.some(name => file.endsWith(`${name}.tsx`))) && !source.includes('QueryErrorState')) {
    ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    const declaration=visitAll(ast,n=>ts.isVariableDeclaration(n)&&ts.isObjectBindingPattern(n.name)&&n.initializer&&ts.isCallExpression(n.initializer)&&/^(useGet|useList).*Query$/.test(n.initializer.expression.getText())&&n.name.elements.some(e=>['data','currentData'].includes((e.propertyName??e.name).getText())))[0];
    if (declaration) {
      const statement=declaration.parent.parent;
      const block=statement.parent;
      if(ts.isBlock(block)) {
        const error=declaration.name.elements.find(e=>(e.propertyName??e.name).getText()==='isError');
        const retry=declaration.name.elements.find(e=>(e.propertyName??e.name).getText()==='refetch');
        const errorName=error?.name.getText()??'isListLoadError';
        const retryName=retry?.name.getText()??'retryListLoad';
        const additions=[!error?'isError: isListLoadError':null,!retry?'refetch: retryListLoad':null].filter(Boolean);
        const anchor=block.statements.find(n=>ts.isReturnStatement(n)||(ts.isIfStatement(n)&&visitAll(n,ts.isReturnStatement).length));
        if(anchor) {
          const guard=`if (${errorName}) return <QueryErrorState message={t('common.queryLoadError')} onRetry={() => void ${retryName}()} />;\n  `;
          source=source.slice(0,anchor.getStart())+guard+source.slice(anchor.getStart());
          if(additions.length) {const at=declaration.name.end-1;const before=source.slice(0,at).trimEnd();source=before+(before.endsWith(',')?'':',')+' '+additions.join(', ')+' '+source.slice(at);}
          source=`import { QueryErrorState } from '@/shared/ui/QueryErrorState';\n`+source;
          audit.push([path.relative(root,file).replaceAll('\\','/'),'added missing query error/retry state']);
        }
      }
    }
  }
  if(source!==fs.readFileSync(file,'utf8'))fs.writeFileSync(file,source);
}
fs.appendFileSync(path.join(__dirname,'DESIGN-SYSTEM-REFRESH-EXECUTION.md'),'\n## Query error migration inventory\n\n| Component | Finding/fix |\n|---|---|\n'+audit.map(([file,note])=>`| ${file} | ${note} |`).join('\n')+'\n');
console.log(JSON.stringify({productionComponentsScanned:files.length,changed:audit.length,files:audit}));
