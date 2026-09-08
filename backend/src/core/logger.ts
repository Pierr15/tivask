import pino from 'pino';
export const logger=pino({name:'TIVAsk',level:process.env.LOG_LEVEL||'info',redact:['password','apiKey','authorization','cookie','DATABASE_URL','GEMINI_API_KEY']});

