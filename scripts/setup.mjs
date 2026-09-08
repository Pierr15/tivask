import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes,scryptSync} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const get=(key,fallback='')=>process.env['TIVASK_SETUP_'+key]||fallback;
const host=get('DB_HOST','127.0.0.1'),port=Number(get('DB_PORT','1234')),user=get('DB_USER','postgres'),database=get('DB_NAME','tivask');
const password=get('DB_PASSWORD'),admin=get('ADMIN_PASSWORD');
if(!password||admin.length<10){console.error('Jalankan scripts/setup-local.ps1. Password admin minimal 10 karakter.');process.exit(1);}
if(!/^[a-z][a-z0-9_]{1,40}$/.test(database)||!Number.isInteger(port)||port<1||port>65535){console.error('Nama database/port tidak valid.');process.exit(1);}
const client=new pg.Client({host,port,user,password,database:'postgres',connectionTimeoutMillis:5000});
try{
 await client.connect();const existing=await client.query('SELECT 1 FROM pg_database WHERE datname=$1',[database]);
 if(!existing.rowCount)await client.query('CREATE DATABASE "'+database+'"');
 await client.end();
 const target=new pg.Client({host,port,user,password,database,connectionTimeoutMillis:5000});await target.connect();
 const tables=await target.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
 if(tables.rows.length){
 const migrations=tables.rows.some(r=>r.tablename==='_prisma_migrations')?await target.query('SELECT migration_name FROM "_prisma_migrations"'):null;
 if(!migrations?.rows.some(r=>r.migration_name==='202609080001_tivask_initial')){
 await target.end();throw new Error('Database ini sudah berisi schema lain. Ulangi setup dengan nama database baru seperti tivask_prototype. Data lama tidak diubah.');
 }
 }await target.end();
 let old={};try{old=dotenv.parse(await readFile(path.join(root,'backend/.env')));}catch{}
 const base=dotenv.parse(await readFile(path.join(root,'backend/.env.example')));
 const salt=randomBytes(16).toString('hex');
 const config={...base,...old,DATABASE_URL:'postgresql://'+encodeURIComponent(user)+':'+encodeURIComponent(password)+'@'+host+':'+port+'/'+database+'?schema=public&connect_timeout=3&pool_timeout=3&connection_limit=5',ADMIN_PASSWORD_HASH:salt+':'+scryptSync(admin,salt,64).toString('hex'),SESSION_SECRET:old.SESSION_SECRET||randomBytes(32).toString('hex'),GEMINI_API_KEY:get('GEMINI_KEY',old.GEMINI_API_KEY||''),WA_AUTO_START:'false'};
 await writeFile(path.join(root,'backend/.env'),Object.entries(config).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n',{mode:0o600});
 console.info('Database siap dan konfigurasi tersimpan di backend/.env. Kredensial tidak ditampilkan.');
}catch(e){await client.end().catch(()=>{});console.error(e instanceof Error&&e.message.includes('schema lain')?e.message:'Tidak bisa menyiapkan PostgreSQL. Periksa host, port, username, password, dan izin CREATE DATABASE.');process.exitCode=1;}

