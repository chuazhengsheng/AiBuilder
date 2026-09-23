(function(root){
 'use strict';
 const labels={person:'PERSON',email:'EMAIL',phone:'PHONE',id:'ID',amount:'AMOUNT',custom:'CUSTOM'};
 const reasons={person:'A name introduced by a person label. Check whether it identifies someone.',email:'An email address can identify or contact a person.',phone:'A Singapore-format phone number. Check whether it should be shared.',id:'An identity-number pattern. This does not validate the number.',amount:'A monetary value may reveal commercial details. Review its context.',custom:'A term you added for this document.'};
 function escapeRegex(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
 function detect(text,custom=[]){
  const candidates=[];
  function add(value,type){if(!value || !value.trim())return;const v=value.trim();if(!candidates.some(c=>c.type===type&&c.value.toLowerCase()===v.toLowerCase()))candidates.push({value:v,type});}
  for(const m of text.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi))add(m[0],'email');
  for(const m of text.matchAll(/\b[STFGM]\d{7}[A-Z]\b/gi))add(m[0],'id');
  for(const m of text.matchAll(/(?<![\w])(?:\+65[ -]?)?[689]\d{3}[ -]?\d{4}(?!\d)/g))add(m[0],'phone');
  for(const m of text.matchAll(/(?:S\$|US\$|SGD|USD|\$)\s*\d(?:[\d,]*\d)?(?:\.\d+)?(?:[a-z]+|\s(?:k|m|mn|mil|mio|b|bn|bil|thousand|million|billion|trillion)\b)?/gi))add(m[0],'amount');
  for(const m of text.matchAll(/^(?:Prepared by|Name|Employee|Applicant|Officer|Patient|Contact person)\s*:\s*([^\n\r,;|]{2,70})/gmi))add(m[1],'person');
  custom.filter(Boolean).forEach(v=>add(v,'custom'));
  const counters={};
  const entities=candidates.map((c,i)=>{
   counters[c.type]=(counters[c.type]||0)+1;
   const ranges=[];const regex=new RegExp(escapeRegex(c.value),'gi');
   for(const m of text.matchAll(regex)){
    const a=m.index,b=a+m[0].length;
    if((/\w/.test(c.value[0])&&a>0&&/\w/.test(text[a-1]))||(/\w/.test(c.value.at(-1))&&b<text.length&&/\w/.test(text[b])))continue;
    ranges.push({start:a,end:b});
   }
   return {...c,id:'e'+i,placeholder:'['+labels[c.type]+' '+counters[c.type]+']',reason:reasons[c.type],ranges,decision:'pending'};
  }).filter(c=>c.ranges.length);
  return entities;
 }
 function operations(entities,includePending=false){
  const ops=[];for(const e of entities)if(e.decision==='mask'||(includePending&&e.decision==='pending'))for(const r of e.ranges)ops.push({...r,entity:e});
  ops.sort((a,b)=>a.start-b.start||b.end-a.end);
  // Merge overlaps so a longer custom term cannot partially expose another selected value.
  const merged=[];for(const o of ops){const last=merged.at(-1);if(last&&o.start<last.end){last.end=Math.max(last.end,o.end);}else merged.push({...o});}return merged;
 }
 function redact(text,entities,mode='labels',includePending=false){let cursor=0,out='';for(const o of operations(entities,includePending)){out+=text.slice(cursor,o.start)+(mode==='remove'?'[REMOVED]':o.entity.placeholder);cursor=o.end;}return out+text.slice(cursor);}
 function escapeHtml(t){return String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 const api={detect,redact,operations,escapeHtml};root.VeilCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
