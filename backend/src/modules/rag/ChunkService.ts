export type TextPage={page:number|null;text:string};
export class ChunkService {
 split(pages:TextPage[],size=1600,overlap=180){
 const chunks:Array<{text:string;page:number|null;chunkIndex:number;tokenCount:number}>=[];
 for(const page of pages){
 const text=page.text.replace(/\u0000/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
 for(let start=0;start<text.length;){
 let end=Math.min(start+size,text.length);if(end<text.length){const boundary=text.lastIndexOf('\n',end);if(boundary>start+size/2)end=boundary;}
 const part=text.slice(start,end).trim();if(part.length>12)chunks.push({text:part,page:page.page,chunkIndex:chunks.length,tokenCount:Math.ceil(part.length/3.5)});
 if(end===text.length)break;start=Math.max(start+1,end-overlap);
 }
 }return chunks;
 }
}

