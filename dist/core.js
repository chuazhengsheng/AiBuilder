(function(root){
 'use strict';
 const labels={person:'PERSON',email:'EMAIL',phone:'PHONE',id:'ID',amount:'AMOUNT',custom:'CUSTOM'};
 const reasons={person:'A name introduced by a person label. Check whether it identifies someone.',email:'An email address can identify or contact a person.',phone:'A Singapore-format phone number. Check whether it should be shared.',id:'An identity-number pattern. This does not validate the number.',amount:'A monetary value may reveal commercial details. Review its context.',custom:'A term you added for this document.'};
 function escapeRegex(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
 // Every whole-word occurrence of a value in the text — shared by the pattern detector and by anything else (linked mentions, AI suggestions) that needs to turn a known value into ranges.
 function rangesFor(text,value){
  const ranges=[];const regex=new RegExp(escapeRegex(value),'gi');
  for(const m of text.matchAll(regex)){
   const a=m.index,b=a+m[0].length;
   if((/\w/.test(value[0])&&a>0&&/\w/.test(text[a-1]))||(/\w/.test(value.at(-1))&&b<text.length&&/\w/.test(text[b])))continue;
   ranges.push({start:a,end:b});
  }
  return ranges;
 }
 function detect(text,custom=[]){
  const candidates=[];
  function add(value,type){if(!value || !value.trim())return;const v=value.trim();if(!candidates.some(c=>c.type===type&&c.value.toLowerCase()===v.toLowerCase()))candidates.push({value:v,type});}
  for(const m of text.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi))add(m[0],'email');
  for(const m of text.matchAll(/\b[STFGM]\d{7}[A-Z]\b/gi))add(m[0],'id');
  for(const m of text.matchAll(/(?<![\w])(?:\+65[ -]?)?[689]\d{3}[ -]?\d{4}(?!\d)/g))add(m[0],'phone');
  for(const m of text.matchAll(/(?:S\$|SGD\s*|\$)\s*\d[\d,]*(?:\.\d{2})?/g))add(m[0],'amount');
  for(const m of text.matchAll(/^(?:Prepared by|Name|Employee|Applicant|Officer|Patient|Contact person)\s*:\s*([^\n\r,;|]{2,70})/gmi))add(m[1],'person');
  custom.filter(Boolean).forEach(v=>add(v,'custom'));
  const counters={};
  const entities=candidates.map((c,i)=>{
   counters[c.type]=(counters[c.type]||0)+1;
   return {...c,id:'e'+i,placeholder:'['+labels[c.type]+' '+counters[c.type]+']',reason:reasons[c.type],ranges:rangesFor(text,c.value),decision:'pending'};
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
 // Splits on sentence-ending punctuation and on line breaks, so a "Label: value" line doesn't drag in whatever the next line happens to say the way a whole paragraph would.
 function splitSentences(text){
  const units=[];let start=0;
  for(let i=0;i<text.length;i++){
   const c=text[i];
   if(c==='\n'){units.push({start,end:i});start=i+1;}
   else if((c==='.'||c==='!'||c==='?')&&(i+1===text.length||/\s/.test(text[i+1]))){units.push({start,end:i+1});start=i+1;}
  }
  units.push({start,end:text.length});
  return units.filter(u=>u.end>u.start&&text.slice(u.start,u.end).trim().length>0);
 }
 // The relation signal a real NER/relation-extraction pass would use: two mentions genuinely stated together in one sentence, plus a structural rule for this label-based document style — a named person presumptively owns the contact-style fields that immediately follow their line, until a blank line or the next named person resets it. Two people simply listed on adjacent lines are NOT related by that alone.
 function relatedPairs(text,entities){
  const pairs=new Map();
  const bump=(x,y)=>{const key=x<y?x+'|'+y:y+'|'+x;pairs.set(key,(pairs.get(key)||0)+1);};
  for(const s of splitSentences(text)){
   const here=entities.filter(e=>e.ranges.some(r=>r.start>=s.start&&r.start<s.end));
   for(let i=0;i<here.length;i++)for(let j=i+1;j<here.length;j++)bump(here[i].id,here[j].id);
  }
  const persons=entities.filter(e=>e.type==='person').map(e=>({e,at:e.ranges[0].start})).sort((a,b)=>a.at-b.at);
  const lineStart=pos=>text.lastIndexOf('\n',pos-1)+1;
  const lineEnd=pos=>{const i=text.indexOf('\n',pos);return i===-1?text.length:i;};
  for(let i=0;i<persons.length;i++){
   const {e:person,at}=persons[i];
   let blockEnd=text.length;
   const blank=text.slice(at).search(/\n[ \t]*\n/);
   if(blank!==-1)blockEnd=Math.min(blockEnd,at+blank);
   if(i+1<persons.length)blockEnd=Math.min(blockEnd,lineStart(persons[i+1].at));
   for(const other of entities){
    if(other.id===person.id||other.type==='person')continue;
    if(other.ranges.some(r=>r.start>lineEnd(at)&&r.start<blockEnd))bump(person.id,other.id);
   }
  }
  return pairs;
 }
 // A masked full name's bare surname elsewhere in the text is a common way redaction leaks; suggest it for confirmation rather than auto-masking it.
 function linkedMentions(text,entities){
  function overlaps(a,b){for(const e of entities)for(const r of e.ranges)if(a<r.end&&b>r.start)return true;return false;}
  const extra=[];let n=0;
  for(const e of entities){
   if(e.type!=='person'||e.decision!=='mask')continue;
   const words=e.value.trim().split(/\s+/);
   if(words.length<2)continue;
   const surname=words.at(-1);
   if(surname.length<2)continue;
   const ranges=[];
   for(const m of text.matchAll(new RegExp('\\b'+escapeRegex(surname)+'\\b','g'))){
    const a=m.index,b=a+m[0].length;
    if(overlaps(a,b))continue;
    ranges.push({start:a,end:b});
   }
   if(!ranges.length)continue;
   n++;
   extra.push({id:'link'+n,type:'person',value:surname,placeholder:e.placeholder,reason:'May be another reference to '+e.value+', which you chose to mask above. Confirm before masking.',ranges,decision:'pending',linkedTo:e.id,linked:true});
  }
  return extra;
 }
 // The "dark" remainder for an optional AI pass: sentences with no already-detected match. Everything else is already handled by patterns and doesn't need to leave the browser.
 function unscannedSentences(text,entities){
  return splitSentences(text).filter(s=>!entities.some(e=>e.ranges.some(r=>r.start>=s.start&&r.start<s.end)));
 }
 // Trust but verify: only accept a model's suggested name if it appears verbatim, as a whole word, inside the very sentence it was claimed from. Rejects hallucinated or out-of-context spans before they ever become a finding.
 function verifyAiNames(text,sentences,results){
  const out=[];
  for(const r of results||[]){
   const s=sentences[r.i];
   if(!s||typeof r.name!=='string')continue;
   const name=r.name.trim();
   if(!name||name.length<2||name.length>80)continue;
   const idx=text.slice(s.start,s.end).search(new RegExp('\\b'+escapeRegex(name)+'\\b','i'));
   if(idx===-1)continue;
   out.push(name);
  }
  return out;
 }
 // Turns verified AI-suggested names into ordinary pending findings, numbered to continue the same [PERSON n] sequence as label-detected names so the final export stays consistent regardless of which pass found what.
 function aiCandidates(text,names,entities){
  let n=entities.filter(e=>e.type==='person').length;
  const seen=new Set(entities.filter(e=>e.type==='person').map(e=>e.value.toLowerCase()));
  const out=[];
  for(const name of names){
   const key=name.toLowerCase();
   if(seen.has(key))continue;
   seen.add(key);
   const ranges=rangesFor(text,name);
   if(!ranges.length)continue;
   n++;
   out.push({id:'ai'+n,type:'person',value:name,placeholder:'[PERSON '+n+']',reason:'Suggested by the optional AI pass — it saw this in a sentence with no label. Confirm it is really a name before masking.',ranges,decision:'pending',ai:true});
  }
  return out;
 }
 const friendlyType={person:'Name',email:'Email address',phone:'Phone number',id:'Identity number',amount:'Monetary value',custom:'Custom term'};
 // Flags kept-detail pairs that are actually, directly related (see relatedPairs), since the combination can identify someone even when no single item does.
 function residualRisk(text,entities){
  const strong=relatedPairs(text,entities);
  const kept=entities.filter(e=>e.decision==='keep');
  const findings=[];
  for(let i=0;i<kept.length;i++)for(let j=i+1;j<kept.length;j++){
   const a=kept[i],b=kept[j];
   const key=a.id<b.id?a.id+'|'+b.id:b.id+'|'+a.id;
   if(strong.has(key))findings.push({types:[friendlyType[a.type]||a.type,friendlyType[b.type]||b.type]});
  }
  return findings;
 }
 // Whole-document relationship view: every pair of detected details is linked (they do, after all, share this one document), but a pair that's actually related (see relatedPairs) gets a strong tie — everything else gets a weak one. Ephemeral and in-session only; nothing here is persisted or linked across documents.
 function coOccurrence(text,entities){
  const nodes=entities.map(e=>({id:e.id,label:e.value,type:e.type,decision:e.decision}));
  const strong=relatedPairs(text,entities);
  const edges=[];
  for(let i=0;i<entities.length;i++)for(let j=i+1;j<entities.length;j++){
   const a=entities[i],b=entities[j];
   const key=a.id<b.id?a.id+'|'+b.id:b.id+'|'+a.id;
   const w=strong.get(key)||0;
   edges.push({a:a.id,b:b.id,weight:w?w+1:0.4,strong:w>0});
  }
  return {nodes,edges};
 }
 // Checks a second, related document (loaded in the same session only) for literal matches of details detected here — a masking-effectiveness check, not a stored link between documents.
 function crossDocumentMatches(entities,otherText){
  return entities.filter(e=>new RegExp('\\b'+escapeRegex(e.value)+'\\b','i').test(otherText));
 }
 function crossDocumentLeaks(entities,otherText){
  return crossDocumentMatches(entities,otherText).filter(e=>e.decision==='mask');
 }
 const api={detect,redact,operations,escapeHtml,linkedMentions,residualRisk,coOccurrence,crossDocumentMatches,crossDocumentLeaks,unscannedSentences,verifyAiNames,aiCandidates};root.VeilCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
