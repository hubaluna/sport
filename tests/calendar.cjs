'use strict';
const fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const CODE=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const EXPORTS="\nreturn {state:()=>S,setState:s=>{S=s;globalThis.forgeState=s;},syncCalendar,calendarMonday,calendarDay,calendarGap,calendarProgramWeek,calendarReturn,dateFor,dateISO,session,pullPlan,makeWorkout,workoutLog,validState,home,plan,profile,render,startWorkout,progressMetrics,pending:()=>pendingWorkout,clearPending:()=>pendingWorkout=null,setDirty:v=>profileDirty=v,save,baseState};";

function makeHarness(seed,instant='2026-11-09T12:00:00Z'){
 let now=Date.parse(instant);const NativeDate=Date;class FakeDate extends NativeDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const storage=new Map();if(seed)storage.set('forge8.mobile.v2',JSON.stringify(seed));
 const nodes={};const node=k=>nodes[k]||(nodes[k]={textContent:'',innerHTML:'',style:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},focus(){},closest(){return null;}});
 const events={};const doc={visibilityState:'visible',querySelector:s=>['#app','#nav','#toast','#connection','#import-file','#exercise-dialog','#close-install','#install-dialog'].includes(s)?node(s):null,querySelectorAll:()=>[],addEventListener:(k,f)=>(events[k]??=[]).push(f)};
 const win={matchMedia:()=>({matches:true}),addEventListener:(k,f)=>(events[k]??=[]).push(f),scrollTo(){}};
 const loc={hash:'#home',protocol:'https:',href:'https://hubaluna.github.io/sport/',origin:'https://hubaluna.github.io',pathname:'/sport/'};
 const storeAPI={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 const globalObj={};
 const exports=new Function('document','window','navigator','location','localStorage','Date','globalThis','setInterval','setTimeout','clearTimeout','requestAnimationFrame','crypto','confirm',CODE+EXPORTS);
 const api=exports(doc,win,{onLine:true},loc,storeAPI,FakeDate,globalObj,()=>0,()=>0,()=>{},f=>f(),{randomUUID:()=> 'test-id'},()=>true);
 api.events=events;api.setTime=x=>{now=NativeDate.parse(x);};api.storage=storage;api.nodes=nodes;return api;
}
let checks=0;function assert(v,msg){checks++;if(!v)throw Error(msg);}
const seedApi=makeHarness(null),base={...seedApi.baseState(),start:'2026-10-19',selectedDay:2,week:2,coach:{strictMax:0,assistedMax:0,assistedROM:60},installDismissed:true};
function log(date,day,week=1,extra={}){return {id:'l'+date.replaceAll('-','')+'d'+day,week,day,date,minutes:40,rounds:0,actual:'Виконано',notes:'',band:'Товста зелена резинка',completed:true,standard:false,pain:0,rpe:7,pullReserve:2,pullQuality:true,started:Date.parse(date+'T12:00:00Z'),ended:Date.parse(date+'T13:00:00Z'),status:'complete',programRevision:'crossfit-2026-10-v4.0',cycleId:'forge8:'+base.start,...extra};}
const last=log('2026-10-28',2),oldLogs=[log('2026-10-26',0),last];
const api=makeHarness({...base,logs:oldLogs});
assert(api.state().selectedDay===0,'Reopen selects Monday Nov9, not old Wed');
assert(api.state().week===1,'Missed sessions do not advance training level');
assert(api.dateFor(2).toISOString().slice(0,10)==='2026-11-11','Current calendar Wednesday');
assert(JSON.stringify(api.state().logs)===JSON.stringify(oldLogs),'History dates and values preserved');
assert(api.calendarReturn(api.state(),api.dateISO()).gap===12,'Twelve-day gap detected');
const a=api.session(1,0),b=api.session(1,2),c=api.session(1,4);
assert(a.returnWorkout&&b.returnWorkout&&c.returnWorkout,'All primary days adapt');
assert(a.pullPlan.targets.length===2,'Foundation 3 sets reduced to2');
assert(a.rows.find(r=>/Віджимання від/.test(r.name)).setsCount===2,'Separate pushup sets reduced');
assert(a.rows.find(r=>/Колесо/.test(r.name)).setsCount===1,'Ab wheel preserved with lower volume');
assert(!a.rows.some(r=>/негативні|часткове підтягування|верхньої позиції/i.test(r.name)),'No strenuous optional pulls during return');
assert(b.rows.find(r=>r.kind==='complex').combo.rounds===2,'Three-round complex reduced to two');
assert(a.warmup.seconds>=600&&a.cooldown.parts.length>1,'Adaptive preparation and cooldown retained');
const workout=api.makeWorkout(1,0,3,base.band,'2026-11-09',Date.parse('2026-11-09T12:00:00Z'),'active-id');
assert(workout.returnWorkout,'Return snapshot marked');
const workoutEntry=api.workoutLog(workout);
assert(workoutEntry.returnWorkout,'Return marker journaled');
assert(api.validState({...api.state(),active:workout}),'New snapshot validates');
api.state().active=workout;const snapshot=JSON.stringify(workout);api.setTime('2026-11-10T12:00:00Z');api.syncCalendar(true);
assert(JSON.stringify(api.state().active)===snapshot,'Running exercise snapshot unchanged on new day');
assert(api.state().selectedDay===1,'Calendar updates even with unfinished workout');
api.state().active=null;api.syncCalendar(true);
assert(api.state().selectedDay===1,'Tuesday rest selected');
assert(api.session(1,1).type==='rest','Recovery day retained');
const oldState=api.state();oldState.logs.push(log('2026-11-09',0,1,{returnWorkout:true}));api.setTime('2026-11-11T12:00:00Z');
assert(api.calendarReturn(oldState,api.dateISO()).remaining===1,'Second return session still light');
oldState.logs.push(log('2026-11-11',2,1,{returnWorkout:true}));
assert(api.calendarReturn(oldState,api.dateISO())===null,'Two actual return sessions finish window');
const complete=[log('2026-10-19',0),log('2026-10-21',2),log('2026-10-23',4)];
const p=makeHarness({...base,logs:complete});
assert(p.state().week===2,'Only one level advanced after completed week, regardless gap');
assert(p.calendarProgramWeek({...base,logs:complete},'2026-10-23')===1,'No advancement during same calendar week');
assert(p.calendarProgramWeek({...base,logs:complete.slice(0,2)},'2026-11-09')===1,'Incomplete week held');
assert(p.calendarProgramWeek({...base,logs:complete.map(l=>({...l,returnWorkout:true}))},'2026-11-09')===1,'Light return cannot graduate level');
assert(p.calendarProgramWeek({...base,logs:complete.map(l=>({...l,pain:2}))},'2026-11-09')===1,'Pain prevents advancement');
assert(p.calendarProgramWeek({...base,logs:complete.map(l=>({...l,rpe:10}))},'2026-11-09')===1,'Excess effort prevents advancement');
assert(p.calendarMonday('2026-03-29')==='2026-03-23','DST Sunday uses civil date');
assert(p.calendarGap('2026-03-30','2026-03-29')===1,'DST day gap');
assert(p.calendarMonday('2027-01-01')==='2026-12-28','Year crossover');
p.setTime('2026-11-15T12:00:00Z');p.syncCalendar(true);assert(p.state().selectedDay===6,'Sunday selected');
assert(p.session(2,6).type==='cardio','Optional recovery retained');
p.setTime('2026-11-16T12:00:00Z');p.events.pageshow[0]();assert(p.state().selectedDay===0,'Pageshow refreshes date');
p.setTime('2026-11-17T12:00:00Z');p.setDirty(true);assert(!p.syncCalendar(true),'Unsaved profile form preserved');p.setDirty(false);p.syncCalendar(true);assert(p.state().selectedDay===1,'Calendar resumes after editing');
for(let w=1;w<=8;w++)for(let day=0;day<7;day++){
 const plain=makeHarness({...base,week:w,logs:[]});plain.state().week=w;
 const returning=makeHarness({...base,logs:[log('2026-10-28',2,w)]});returning.state().week=w;
 const normal=plain.session(w,day),light=returning.session(w,day);
 assert(normal.rows.length>0&&light.rows.length>0,'Rows exist '+w+'/'+day);
 if([0,2,4].includes(day)){assert(light.returnWorkout,'Return applied '+w+'/'+day);assert(!light.rows.some(r=>r.kind==='test'),'Tests deferred '+w+'/'+day);assert(light.rows.find(r=>r.kind==='warm').seconds>=600,'Full prep retained '+w+'/'+day);}
 assert(plain.home().includes('9 листопада'),'Home current date '+w+'/'+day);
 assert(returning.validState(returning.state()),'State validation '+w+'/'+day);
}
assert(api.calendarDay('2026-10-28')===2,'Original reported day correct');
console.log({checks,passed:true});
