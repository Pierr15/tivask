import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './core/logger.js';
import { prisma } from './core/prisma.js';
import { knowledge,persistence,whatsapp,documents } from './container.js';
const server=app.listen(env.PORT,env.HOST,()=>logger.info({port:env.PORT,host:env.HOST},'TIVAsk Control Center ready'));
server.on('error',e=>{logger.error({code:(e as NodeJS.ErrnoException).code},'Server could not listen');process.exitCode=1;});
void knowledge.load().catch(()=>logger.warn('Knowledge fallback unavailable'));
void documents.recover();
void prisma.systemSetting.findUnique({where:{key:'contact'}}).then(row=>{if(row&&row.value&&typeof row.value==='object'&&!Array.isArray(row.value)){const value=row.value;if(typeof value.panitiaName==='string')env.PANITIA_NAME=value.panitiaName;if(typeof value.panitiaWa==='string')env.PANITIA_WA=value.panitiaWa;}}).catch(()=>{});
if(env.WA_AUTO_START)void whatsapp.connect().catch(()=>logger.warn('WhatsApp initialization failed'));
const timer=setInterval(()=>{void persistence.sync();},15000);timer.unref();
async function shutdown(){clearInterval(timer);await whatsapp.disconnect();await persistence.sync();await prisma.$disconnect();server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),5000).unref();}
process.once('SIGINT',()=>void shutdown());process.once('SIGTERM',()=>void shutdown());

