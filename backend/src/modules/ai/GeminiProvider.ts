import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';
import { SYSTEM_PROMPT,buildPrompt } from './PromptEngine.js';
import type { Evidence } from './GroundingValidator.js';
export class GeminiProvider{
 private client=env.GEMINI_API_KEY?new GoogleGenAI({apiKey:env.GEMINI_API_KEY,httpOptions:{timeout:env.AI_TIMEOUT_MS}}):null;
 status=env.GEMINI_API_KEY?'NOT_TESTED':'NOT_CONFIGURED';lastChecked:string|null=null;private cooldown=0;
 available(){return !!this.client&&Date.now()>this.cooldown;}
 async select(question:string,evidence:Evidence[],history:Array<{role:string;content:string}>){
 if(!this.available()||!this.client)throw new Error('GEMINI_UNAVAILABLE');
 try{
 const r=await this.client.models.generateContent({model:env.GEMINI_MODEL,contents:buildPrompt(question,evidence,history),config:{systemInstruction:SYSTEM_PROMPT,responseMimeType:'application/json',temperature:0,maxOutputTokens:1600}});
 this.status='ONLINE';this.lastChecked=new Date().toISOString();return JSON.parse(r.text??'{}') as unknown;
 }catch(e){this.status='ERROR';this.lastChecked=new Date().toISOString();this.cooldown=Date.now()+60000;throw e;}
 }
 async check(){if(!this.client)return this.status;try{await this.client.models.get({model:env.GEMINI_MODEL});this.status='REACHABLE';}catch{this.status='ERROR';}this.lastChecked=new Date().toISOString();return this.status;}
}

