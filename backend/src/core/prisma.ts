import { PrismaClient } from '@prisma/client';
import './noop.js';
import { env } from '../config/env.js';
export const prisma=new PrismaClient({datasources:{db:{url:env.DATABASE_URL}}});
let failedUntil=0;
export const databaseCoolingDown=()=>Date.now()<failedUntil;
export async function db<T>(action:()=>Promise<T>):Promise<T>{
 if(Date.now()<failedUntil) throw new Error('DATABASE_TEMPORARILY_UNAVAILABLE');
 try {const result=await action();failedUntil=0;return result;} catch(e){if(isConnectionError(e)) failedUntil=Date.now()+10000;throw e;}
}
function isConnectionError(e:unknown){return e instanceof Error&&/P1001|P1002|P1017|reach database|connect|closed|timeout/i.test(e.message);}
export async function databaseHealth(){
 try {await prisma.$queryRaw`SELECT 1`;failedUntil=0;
 const tables=await prisma.$queryRaw<Array<{exists:boolean}>>`SELECT to_regclass('public."KnowledgeEntity"') IS NOT NULL AS exists`;
 const vector=await prisma.$queryRaw<Array<{exists:boolean}>>`SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector') AS exists`;
 return {status:'ONLINE',schema:tables[0]?.exists?'READY':'MISSING',pgvector:vector[0]?.exists??false};
 }catch {failedUntil=Date.now()+10000;return {status:'OFFLINE',schema:'UNKNOWN',pgvector:false};}
}
