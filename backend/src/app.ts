import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { ZodError } from 'zod';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { router } from './routes/index.js';
import { env,backendRoot } from './config/env.js';
import { originGuard } from './middleware/auth.js';
import { AppError } from './core/errors.js';
import { logger } from './core/logger.js';
export const app=express();
app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:{directives:{"img-src":["'self'","data:"],"script-src":["'self'"],"style-src":["'self'","'unsafe-inline'"]}}}));
app.use(cors({origin:[env.FRONTEND_URL,'http://127.0.0.1:3001','http://localhost:3001'],credentials:true}));
app.use(cookieParser(),originGuard,express.json({limit:'256kb'}));
app.use('/api',rateLimit({windowMs:60000,limit:300,standardHeaders:true,legacyHeaders:false}));
app.use('/api/v1',router);
app.use('/api',(_req,res)=>res.status(404).json({ok:false,error:'Endpoint tidak ditemukan.'}));
const dashboard=path.resolve(backendRoot,'../dashboard/dist');
if(existsSync(dashboard)){app.use(express.static(dashboard));app.get('/{*splat}',(_req,res)=>res.sendFile(path.join(dashboard,'index.html')));}
app.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
 if(error instanceof ZodError){res.status(400).json({ok:false,error:'Data tidak valid.',details:error.flatten()});return;}
 if(error instanceof AppError){res.status(error.status).json({ok:false,error:error.message});return;}
 const code=typeof error==='object'&&error!==null&&'code' in error?String(error.code):'UNKNOWN';
 const status=code==='P2025'?404:code==='P2002'?409:code==='LIMIT_FILE_SIZE'?413:503;
 logger.warn({code},'Request failed');
 res.status(status).json({ok:false,error:status===413?'File maksimal 10 MB.':status===404?'Data tidak ditemukan.':status===409?'Data sudah ada atau bertabrakan.':'Layanan belum tersedia. Periksa database atau konfigurasi pada halaman Overview.'});
});

