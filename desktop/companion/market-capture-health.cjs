'use strict';
// Reports only non-identifying image quality metrics. No screenshots are
// retained by this module or sent to any service.
function inspectBgra(bitmap,width,height) {
 if(!Buffer.isBuffer(bitmap)||!Number.isSafeInteger(width)||
  !Number.isSafeInteger(height)||width<1||height<1||
  bitmap.length<width*height*4)return null;
 const step=Math.max(1,Math.floor(Math.sqrt(width*height/12000)));
 let n=0,sum=0,sumSq=0,bright=0,dark=0,alpha=0;
 for(let y=0;y<height;y+=step)for(let x=0;x<width;x+=step){
  const i=(y*width+x)*4;
  const b=bitmap[i],g=bitmap[i+1],r=bitmap[i+2],a=bitmap[i+3];
  const v=(54*r+183*g+19*b)/256;
  sum+=v;sumSq+=v*v;n++;
  if(v>=170)bright++;
  if(v<=12)dark++;
  if(a<128)alpha++;
 }
 const mean=sum/n,contrast=Math.sqrt(Math.max(0,sumSq/n-mean*mean));
 // "blank-like" means the captured image probably lacks readable content.
 // Dark game UIs are not blank simply because their average luminance is low.
 const blankLike=contrast<6 && (mean<20||mean>248||alpha/n>.98);
 return {
  mean:Math.round(mean),contrast:Math.round(contrast),
  brightPercent:Math.round(1000*bright/n)/10,
  darkPercent:Math.round(1000*dark/n)/10,
  blankLike,signal:blankLike?'blank-like':'visual-detail'
 };
}
module.exports={inspectBgra};
