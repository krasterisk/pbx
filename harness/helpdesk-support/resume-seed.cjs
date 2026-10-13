const path=require('node:path');const root=path.resolve(__dirname,'../..');
module.exports=async input=>{
 if(input.CI!=='true'||input.DB_NAME!=='krasterisk_ci_supportlab'||input.DB_HOST!=='127.0.0.1'||!['13319','15439'].includes(input.DB_PORT))throw Error('Only explicit support QA fixture can resume');
 const bcrypt=require(path.join(root,'node_modules/bcrypt'));let rows;
 if(input.DB_DIALECT==='mysql'){const db=await require(path.join(root,'node_modules/mysql2/promise')).createConnection({host:input.DB_HOST,port:Number(input.DB_PORT),user:input.DB_USER,password:input.DB_PASSWORD,database:input.DB_NAME});try{[rows]=await db.query('SELECT login,passwd FROM users WHERE login IN (?,?,?) OR level=0',['admin','ci-tenant-a','ci-tenant-b']);}finally{await db.end();}}
 else {const {Client}=require(path.join(root,'node_modules/pg'));const db=new Client({host:input.DB_HOST,port:Number(input.DB_PORT),user:input.DB_USER,password:input.DB_PASSWORD,database:input.DB_NAME});await db.connect();try{rows=(await db.query('SELECT login,passwd FROM users WHERE login IN ($1,$2,$3) OR level=0',['admin','ci-tenant-a','ci-tenant-b'])).rows;}finally{await db.end();}}
 if(!rows.length)return false;
 if(rows.length!==3||new Set(rows.map(r=>r.login)).size!==3||rows.some(r=>!['admin','ci-tenant-a','ci-tenant-b'].includes(r.login)))throw Error('Unexpected fixture accounts; resume refused');
 for(const row of rows)if(!await bcrypt.compare(input.CI_SEED_PASSWORD,row.passwd))throw Error('Fixture account mismatch; resume refused');
 console.log('LAB prior synthetic seed verified; no account overwritten');return true;
};
