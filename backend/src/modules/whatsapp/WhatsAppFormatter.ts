export function formatWhatsApp(text:string){return text.replace(/\*\*(.*?)\*\*/g,'*$1*').replace(/^#{1,6}\s+/gm,'').replace(/^[-+]\s+/gm,'• ').replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,'$1: $2').trim().slice(0,12000);}
export function splitWhatsApp(text:string,max=3500){const blocks:string[]=[];let remaining=formatWhatsApp(text);while(remaining.length>max){let end=remaining.lastIndexOf('\n',max);if(end<max/2)end=max;blocks.push(remaining.slice(0,end));remaining=remaining.slice(end).trim();}if(remaining)blocks.push(remaining);return blocks;}

