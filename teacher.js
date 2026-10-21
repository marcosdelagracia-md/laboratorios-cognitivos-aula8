import {auth,db} from './firebase-client.js';
import {signInWithEmailAndPassword,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {collection,doc,getDoc,getDocs,setDoc,writeBatch,onSnapshot} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
const $=id=>document.getElementById(id),labs=['wasi','fdt','ravlt','d2r','tmt','tol'],PROF='TXh88MO29fVS0jMLeCLcBLLxx172';let data=[],unsubscribeParticipants=null,unsubscribeSettings=null,applicationOpen=false;
function msg(s){$('message').textContent=s}
onAuthStateChanged(auth,u=>{const ok=!!u&&!u.isAnonymous&&u.uid===PROF;$('login').classList.toggle('hidden',ok);$('admin').classList.toggle('hidden',!ok);if(ok){startLive();}else{stopLive();if(u)msg('Esta conta não está autorizada como professor.');}});
$('signIn').onclick=async()=>{try{await signInWithEmailAndPassword(auth,$('email').value,$('password').value)}catch(e){msg('Falha no login: '+e.message)}};
$('signOut').onclick=()=>signOut(auth);
function stopLive(){if(unsubscribeParticipants){unsubscribeParticipants();unsubscribeParticipants=null}if(unsubscribeSettings){unsubscribeSettings();unsubscribeSettings=null}}
function startLive(){stopLive();unsubscribeParticipants=onSnapshot(collection(db,'participants'),snap=>{data=snap.docs.map(d=>({code:d.id,...d.data()})).sort((a,b)=>a.code.localeCompare(b.code));render();},e=>msg('Falha ao acompanhar participantes: '+e.message));unsubscribeSettings=onSnapshot(doc(db,'settings','application'),snap=>{applicationOpen=!!snap.exists()&&snap.data().open===true;msg('Painel em tempo real. Aplicação '+(applicationOpen?'ABERTA':'FECHADA')+'.')},e=>msg('Falha ao acompanhar aplicação: '+e.message))}
async function refresh(){try{const s=await getDocs(collection(db,'participants'));data=s.docs.map(d=>({code:d.id,...d.data()})).sort((a,b)=>a.code.localeCompare(b.code));render();msg('Dados atualizados. Aplicação '+(applicationOpen?'ABERTA':'FECHADA')+'.')}catch(e){msg('Falha ao consultar dados: '+e.message)}}
$('refresh').onclick=refresh;
function render(){const n=data.length,all=data.filter(d=>labs.every(l=>d.completed?.[l])).length;
$('summary').textContent=`${n}/60 participantes registrados (${(n/60*100).toFixed(1)}%) · ${all} concluíram os seis (${(all/60*100).toFixed(1)}% da turma).`;
$('cards').innerHTML=labs.map(l=>{let done=data.filter(d=>d.completed?.[l]).length,started=data.filter(d=>d.started?.[l]).length,p=100*done/60;return `<div class="card"><strong>${l.toUpperCase()}</strong><div class="big">${p.toFixed(1)}%</div><div>${done} de 60 concluíram</div><div class="bar"><span style="width:${p}%"></span></div><small>${started} iniciaram</small></div>`}).join('');
$('rows').innerHTML=data.map(d=>`<tr><td>${d.code}</td>${labs.map(l=>`<td>${d.completed?.[l]?'✓ Concluído':d.started?.[l]?'◐ Iniciado':'—'}</td>`).join('')}</tr>`).join('');}
$('openApp').onclick=async()=>{try{await setDoc(doc(db,'settings','application'),{open:true});await refresh()}catch(e){msg('Erro: '+e.message)}};
$('closeApp').onclick=async()=>{try{await setDoc(doc(db,'settings','application'),{open:false});await refresh()}catch(e){msg('Erro: '+e.message)}};
$('export').onclick=()=>{const rows=[['codigo',...labs.map(l=>l+'_inicio'),...labs.map(l=>l+'_conclusao')],...data.map(d=>[d.code,...labs.map(l=>d.started?.[l]?'sim':'nao'),...labs.map(l=>d.completed?.[l]?'sim':'nao')])];const csv='\uFEFF'+rows.map(r=>r.join(';')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='participacao_laboratorios.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
$('reset').onclick=async()=>{if(!confirm('ATENÇÃO: encerre a aplicação e exporte os dados antes de zerar. Excluir todos os registros permanentemente?'))return;if(prompt('Digite ZERAR APLICACAO para confirmar:')!=='ZERAR APLICACAO')return;$('reset').disabled=true;try{
 await setDoc(doc(db,'settings','application'),{open:false});
 const snap=await getDocs(collection(db,'participants'));
 for(let i=0;i<snap.docs.length;i+=400){const batch=writeBatch(db);snap.docs.slice(i,i+400).forEach(d=>batch.delete(d.ref));await batch.commit()}
 const sessions=await getDocs(collection(db,'studentSessions'));
 for(let i=0;i<sessions.docs.length;i+=400){const batch=writeBatch(db);sessions.docs.slice(i,i+400).forEach(d=>batch.delete(d.ref));await batch.commit()}
 await refresh();msg('Participantes e sessões apagados. Aplicação FECHADA. Abra-a quando iniciar a próxima turma.');
}catch(e){msg('Erro durante a exclusão: '+e.message+' Confira os registros restantes.')}finally{$('reset').disabled=false}};
