import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
export const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({path:path.join(backendRoot,'.env'), quiet:true});
const bool = z.enum(['true','false']).transform(v=>v==='true');
export const env = z.object({
 NODE_ENV:z.string().default('development'), HOST:z.string().default('127.0.0.1'),
 PORT:z.coerce.number().int().default(3000), FRONTEND_URL:z.string().default('http://localhost:3001'),
 DATABASE_URL:z.string().default('postgresql://postgres:unset@127.0.0.1:1234/tivask?connect_timeout=2&pool_timeout=2&connection_limit=5'),
 GEMINI_API_KEY:z.string().default(''), GEMINI_MODEL:z.string().default('gemini-2.5-flash'),
 GEMINI_EMBEDDING_MODEL:z.string().default('gemini-embedding-001'),
 RAG_TOP_K:z.coerce.number().int().min(1).max(10).default(5), RAG_MIN_SCORE:z.coerce.number().min(0).max(1).default(.65),
 CONVERSATION_HISTORY_LIMIT:z.coerce.number().int().min(2).max(30).default(10),
 AI_TIMEOUT_MS:z.coerce.number().int().min(1000).max(60000).default(18000),
 WA_AUTO_START:bool.default('false'), WA_SESSION_PATH:z.string().default('.wwebjs_auth'),
 CHROME_EXECUTABLE_PATH:z.string().default(''), BOT_NAME:z.literal('TIVAsk').default('TIVAsk'),
 SCHOOL_NAME:z.string().default('SMK Negeri 1 Adiwerna'), ACADEMIC_YEAR:z.string().default('2026/2027'),
 PANITIA_NAME:z.string().default('Panitia SPMB SMK Negeri 1 Adiwerna'), PANITIA_WA:z.string().default(''),
 DEMO_MODE:bool.default('true'), ADMIN_USERNAME:z.string().default('admin'),
 ADMIN_PASSWORD_HASH:z.string().default(''), SESSION_SECRET:z.string().default(''),
 COOKIE_SECURE:bool.default('false')
}).parse(process.env);
process.env.DATABASE_URL=env.DATABASE_URL;
export const dataPath=(...segments:string[])=>path.join(backendRoot,'data',...segments);

