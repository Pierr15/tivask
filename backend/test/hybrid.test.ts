import test from 'node:test';
import assert from 'node:assert/strict';
import { IntentRouter } from '../src/modules/ai/IntentRouter.js';
import { LocalSemanticEngine } from '../src/modules/ai/LocalSemanticEngine.js';
import { GroundingValidator,type Evidence } from '../src/modules/ai/GroundingValidator.js';
import { lexicalScore,supportsQuery } from '../src/modules/ai/QuerySignals.js';
import { fuseHybridEvidence } from '../src/modules/rag/RetrievalService.js';
import type { KnowledgeItem } from '../src/modules/knowledge/types.js';

test('lexical relevance distinguishes the requested cost item',()=>{
 const q='Berapa biaya seragam perempuan?';
 const right='Biaya seragam perempuan adalah Rp275.000.';
 const wrong='Biaya pendaftaran perempuan adalah Rp100.000.';
 assert.ok(lexicalScore(q,right)>lexicalScore(q,wrong));
 assert.equal(supportsQuery(q,right),true);
 assert.equal(supportsQuery(q,wrong),false);
});

test('hybrid reranking rejects wrong item and wrong gender despite high vector score',()=>{
 const q='Berapa biaya seragam perempuan?';
 const vector:Evidence[]=[
 {id:'registration',text:'Biaya pendaftaran perempuan adalah Rp100.000.',source:'fixture',score:.96},
 {id:'male',text:'Biaya seragam laki laki adalah Rp250.000.',source:'fixture',score:.99},
 {id:'female',text:'Biaya seragam perempuan adalah Rp275.000.',source:'fixture',score:.70}
 ];
 const lexical:Evidence[]=[{...vector[2],score:lexicalScore(q,vector[2].text)}];
 const result=fuseHybridEvidence(q,vector,lexical,5,.65);
 assert.equal(result[0]?.id,'female');
 assert.equal(result.some(e=>e.id==='registration'),false);
 assert.equal(result.some(e=>e.id==='male'),false);
});

test('lexical-only evidence can answer when embeddings are unavailable',()=>{
 const q='Berapa biaya pendaftaran?';
 const e:Evidence={id:'registration',text:'Biaya pendaftaran adalah Rp100.000.',source:'fixture',score:lexicalScore(q,'Biaya pendaftaran adalah Rp100.000.')};
 const result=fuseHybridEvidence(q,[],[e],5,.65);
 assert.equal(result[0]?.id,'registration');
});

test('query-aware grounding rejects an exact quote from the wrong context',()=>{
 const grounding=new GroundingValidator();
 const evidence:Evidence[]=[
 {id:'registration',text:'Biaya pendaftaran perempuan adalah Rp100.000.',source:'fixture',score:.91},
 {id:'uniform',text:'Biaya seragam perempuan adalah Rp275.000.',source:'fixture',score:.88}
 ];
 const q='Berapa biaya seragam perempuan?';
 assert.equal(grounding.validate({quotes:[{id:'registration',quote:evidence[0].text}],abstain:false},evidence,q),null);
 assert.equal(grounding.validate({quotes:[],abstain:true},evidence,q),null);
 assert.equal(grounding.validate({quotes:[{id:'uniform',quote:evidence[1].text}],abstain:false},evidence,q)?.length,1);
});

test('verified FAQ can be selected before document RAG',()=>{
 const items:KnowledgeItem[]=[
 {id:'faq-free',category:'FAQ',title:'Biaya pendaftaran',content:'Pendaftaran SPMB tidak dikenakan biaya.',keywords:['pendaftaran','gratis'],details:{question:'Apakah pendaftaran SPMB gratis?'},demo:false,verified:true},
 {id:'faq-uniform',category:'FAQ',title:'Seragam',content:'Informasi seragam tersedia setelah daftar ulang.',keywords:['seragam'],details:{question:'Kapan seragam dibagikan?'},demo:false,verified:true}
 ];
 const intent=new IntentRouter().route('Apakah pendaftaran SPMB gratis?',[]);
 const result=new LocalSemanticEngine().selectFaq(intent,items);
 assert.equal(result[0]?.id,'faq-free');
 assert.equal(result.some(i=>i.id==='faq-uniform'),false);
});
