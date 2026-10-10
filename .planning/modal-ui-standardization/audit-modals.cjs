const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const inventoryPath = path.join(__dirname, 'INVENTORY.json');
const projectRoot = path.resolve(__dirname, '../..');
const previous = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
const inventory = new Map(previous.map(item => [item.file, item]));
function discover(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) discover(file);
    else if (/\.tsx$/.test(entry.name) && !/\.(test|spec)\.tsx$/.test(entry.name)) {
      const source = fs.readFileSync(file, 'utf8');
      if (/<(?:FormDialogContent|DialogContent|FormSheetContent|SheetContent)\b|role=["']dialog["']|from\s+["']@radix-ui\/react-dialog/.test(source)) {
        const relative = path.relative(projectRoot, file).replace(/\\/g, '/');
        if (!inventory.has(relative)) inventory.set(relative, { file: relative, jsx: [], status: 'audit-pending' });
      }
    }
  }
}
discover(path.join(projectRoot, 'packages/frontend/src'));
for (const item of inventory.values()) {
  const source = fs.readFileSync(path.join(projectRoot, item.file), 'utf8');
  const ast = ts.createSourceFile(item.file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  item.currentJsx = [];
  item.tooltipTitleDuplicates = [];
  item.nativeAlerts = [];
  item.rawRadix = /from\s+["']@radix-ui\/react-dialog/.test(source);
  function visit(node) {
    const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : undefined;
    if (opening) {
      const tag = opening.tagName.getText(ast);
      if (['DialogContent', 'FormDialogContent', 'SheetContent', 'FormSheetContent', 'ModalBody', 'ModalSection', 'ModalTabs', 'ModalToggle'].includes(tag)) {
        item.currentJsx.push({ tag, props: opening.attributes.getText(ast).slice(0, 230) });
      }
      if (['Tooltip', 'TooltipTrigger', 'InfoTooltip'].includes(tag) && ts.isJsxElement(node)) {
        function checkTitles(child) {
          const element = ts.isJsxElement(child) ? child.openingElement : ts.isJsxSelfClosingElement(child) ? child : undefined;
          if (element) {
            if (element.tagName.getText(ast) === 'TooltipContent') return;
            const title = element.attributes.properties.find(prop => ts.isJsxAttribute(prop) && prop.name.getText(ast) === 'title');
            if (title) item.tooltipTitleDuplicates.push({ line: ast.getLineAndCharacterOfPosition(element.getStart(ast)).line + 1, expression: title.getText(ast) });
          }
          ts.forEachChild(child, checkTitles);
        }
        node.children.forEach(checkTitles);
      }
    }
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'alert') {
      item.nativeAlerts.push(ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  // Status and coverageNote are reviewed assignments, not inferred proof of UX correctness.
  item.visual = 'tool-unavailable';
}
const result = [...inventory.values()];
fs.writeFileSync(inventoryPath, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({
  files: result.length,
  statuses: result.reduce((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {}),
  rawOutsideShared: result.filter(item => item.rawRadix && !item.file.includes('/shared/ui/')).map(item => item.file),
  tooltipTitleDuplicates: result.filter(item => item.tooltipTitleDuplicates.length).map(item => item.file),
  nativeAlerts: result.filter(item => item.nativeAlerts.length).map(item => item.file),
}, null, 2));
