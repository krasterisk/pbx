'use strict';
const fs=require('node:fs'),path=require('node:path');
const {artifactsRoot,repository}=require('./paths.cjs');
const root=artifactsRoot();
function link(source,target){
 if(fs.existsSync(source)){
  const stat=fs.lstatSync(source);
  if(!stat.isSymbolicLink()||fs.realpathSync(source).toLowerCase()!==fs.realpathSync(target).toLowerCase())throw Error('Existing path differs; refusing to replace: '+source);
  return;
 }
 fs.mkdirSync(target,{recursive:true});fs.mkdirSync(path.dirname(source),{recursive:true});
 fs.symlinkSync(target,source,process.platform==='win32'?'junction':'dir');
}
fs.mkdirSync(root,{recursive:true});
link(path.join(repository,'.artifacts'),root);
link(path.join(root,'legacy','node_modules'),path.join(repository,'node_modules'));
console.log(JSON.stringify({root,alias:path.join(repository,'.artifacts')}));
