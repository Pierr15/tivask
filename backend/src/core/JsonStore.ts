import { mkdir,readFile,writeFile,rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
export class JsonStore<T>{
 private pending:Promise<unknown>=Promise.resolve();
 constructor(private filename:string,private initial:()=>T){}
 async read():Promise<T>{await this.pending;return this.readUnlocked();}
 private async readUnlocked():Promise<T>{try{return JSON.parse(await readFile(this.filename,'utf8')) as T;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return this.initial();throw e;}}
 update<R>(fn:(data:T)=>R|Promise<R>):Promise<R>{
 const job=this.pending.then(async()=>{const data=await this.readUnlocked();const result=await fn(data);
 await mkdir(path.dirname(this.filename),{recursive:true});const temp=this.filename+'.'+randomUUID()+'.tmp';
 await writeFile(temp,JSON.stringify(data,null,2),{mode:0o600});await rename(temp,this.filename);return result;});
 this.pending=job.catch(()=>{});return job;
 }
}

