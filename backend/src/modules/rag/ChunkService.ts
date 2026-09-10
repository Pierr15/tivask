export type TextPage={page:number|null;text:string};
export type TextChunk={text:string;page:number|null;chunkIndex:number;tokenCount:number};

function cleanText(text:string){
 return text.replace(/\u0000/g,'').replace(/\r\n?/g,'\n').replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}

function hardSplit(text:string,size:number){
 const parts:string[]=[];
 let rest=text.trim();
 while(rest.length>size){
  const window=rest.slice(0,size+1);
  const sentence=Math.max(window.lastIndexOf('. '),window.lastIndexOf('? '),window.lastIndexOf('! '),window.lastIndexOf('; '));
  const whitespace=window.lastIndexOf(' ');
  const cut=sentence>=Math.floor(size*.55)?sentence+1:whitespace>=Math.floor(size*.55)?whitespace:size;
  parts.push(rest.slice(0,cut).trim());
  rest=rest.slice(cut).trim();
 }
 if(rest)parts.push(rest);
 return parts;
}

function semanticUnits(text:string,size:number){
 const blocks=text.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
 const units:string[]=[];
 for(const block of blocks){
  // Single newlines often represent table rows, list items, or PDF visual lines.
  // Treat them as atomic units first so a row is not cut in the middle.
  const rows=block.includes('\n')?block.split('\n').map(line=>line.trim()).filter(Boolean):[block];
  for(const row of rows){
   if(row.length<=size){units.push(row);continue;}
   const sentences=row.split(/(?<=[.!?])\s+(?=[\p{L}\p{N}#(\[])/u).map(s=>s.trim()).filter(Boolean);
   if(sentences.length<=1){units.push(...hardSplit(row,size));continue;}
   let group='';
   for(const sentence of sentences){
    if(sentence.length>size){
     if(group){units.push(group);group='';}
     units.push(...hardSplit(sentence,size));
     continue;
    }
    const next=group?group+' '+sentence:sentence;
    if(next.length>size){if(group)units.push(group);group=sentence;}else group=next;
   }
   if(group)units.push(group);
  }
 }
 return units;
}

function overlapTail(units:string[],overlap:number){
 if(overlap<=0||!units.length)return [] as string[];
 const tail:string[]=[];let length=0;
 for(let i=units.length-1;i>=0;i--){
  const next=units[i];
  if(!tail.length&&next.length>overlap)break;
  if(tail.length&&length+next.length+2>overlap)break;
  tail.unshift(next);length+=next.length+(tail.length>1?2:0);
  if(length>=overlap)break;
 }
 return tail;
}

export class ChunkService {
 split(pages:TextPage[],size=1600,overlap=180):TextChunk[]{
  const chunks:TextChunk[]=[];
  for(const page of pages){
   const text=cleanText(page.text);if(!text)continue;
   const units=semanticUnits(text,size);let current:string[]=[];
   const emit=()=>{
    const part=current.join('\n\n').trim();
    if(part.length>12)chunks.push({text:part,page:page.page,chunkIndex:chunks.length,tokenCount:Math.ceil(part.length/3.5)});
   };
   for(const unit of units){
    const candidate=[...current,unit].join('\n\n');
    if(current.length&&candidate.length>size){
     const previous=[...current];emit();current=overlapTail(previous,overlap);
     while(current.length&&[...current,unit].join('\n\n').length>size)current.shift();
    }
    current.push(unit);
   }
   if(current.length)emit();
  }
  return chunks;
 }
}
