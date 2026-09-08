import { AppError } from './errors.js';
export class KeyQueue {
 private tails=new Map<string,Promise<unknown>>(); private count=0;
 run<T>(key:string,work:()=>Promise<T>):Promise<T>{
 if(this.count>=60)return Promise.reject(new AppError(429,'Antrean sedang penuh. Coba lagi sebentar.'));
 this.count++; const previous=this.tails.get(key)??Promise.resolve();
 const task=previous.catch(()=>{}).then(work);this.tails.set(key,task);
 return task.finally(()=>{this.count--;if(this.tails.get(key)===task)this.tails.delete(key);});
 }
}

