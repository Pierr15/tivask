import { randomBytes,scryptSync,timingSafeEqual,createHmac } from 'node:crypto';
import type { Request,Response,NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../core/errors.js';
const sessions=new Map<string,number>();
const digest=(token:string)=>createHmac('sha256',env.SESSION_SECRET||'unconfigured').update(token).digest('hex');
export function configured(){return env.ADMIN_PASSWORD_HASH.includes(':')&&env.SESSION_SECRET.length>=32;}
export function verifyPassword(password:string,stored:string){
 try{const [salt,hex]=stored.split(':');const expected=Buffer.from(hex,'hex');const value=scryptSync(password,salt,64);return expected.length===value.length&&timingSafeEqual(expected,value);}catch{return false;}
}
export function authenticated(req:Request){const token=req.cookies?.tivask_session;return typeof token==='string'&&(sessions.get(digest(token))??0)>Date.now();}
export function requireAuth(req:Request,_res:Response,next:NextFunction){if(!authenticated(req))return next(new AppError(401,'Silakan login terlebih dahulu.'));next();}
export function login(username:string,password:string,res:Response){
 if(!configured())throw new AppError(503,'Admin belum disiapkan. Jalankan scripts/setup-local.ps1.');
 if(username!==env.ADMIN_USERNAME||!verifyPassword(password,env.ADMIN_PASSWORD_HASH))throw new AppError(401,'Username atau password tidak sesuai.');
 for(const [key,exp] of sessions)if(exp<Date.now())sessions.delete(key);
 const token=randomBytes(32).toString('hex');sessions.set(digest(token),Date.now()+8*3600000);
 res.cookie('tivask_session',token,{httpOnly:true,sameSite:'strict',secure:env.COOKIE_SECURE,maxAge:8*3600000,path:'/'});
}
export function logout(req:Request,res:Response){if(req.cookies?.tivask_session)sessions.delete(digest(req.cookies.tivask_session));res.clearCookie('tivask_session',{path:'/'});}
export const loginLimiter=rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:true,legacyHeaders:false});
export function originGuard(req:Request,_res:Response,next:NextFunction){
 if(['GET','HEAD','OPTIONS'].includes(req.method))return next();
 const allowed=[env.FRONTEND_URL,'http://localhost:3001','http://127.0.0.1:3001','http://localhost:'+env.PORT,'http://127.0.0.1:'+env.PORT];
 if(req.headers.origin&&!allowed.includes(req.headers.origin))return next(new AppError(403,'Origin tidak diizinkan.'));
 next();
}

