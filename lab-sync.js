import {auth,db} from './firebase-client.js';
import {signInAnonymously,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {doc,getDoc,runTransaction,serverTimestamp,updateDoc} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
const lab=window.LAB_ID;
const $=id=>document.getElementById(id);
const slot=i=>'PSI'+String(i).padStart(3,'0');
let code=null,started=false,completed=false,registering=false,saving=false;
function status(s,error=false){const el=$('portalStatus');el.textContent=s;el.classList.toggle('error',error)}
function randomizedSlots(){const a=Array.from({length:60},(_,i)=>i+1);for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
async function enroll(user){
 if(registering||code)return;
 registering=true;
 try{
  const settings=await getDoc(doc(db,'settings','application'));
  if(!settings.exists()||settings.data().open!==true)throw Error('A aplicação está fechada. Procure o professor.');
  status('Identificando sua participação...');
  const sessionRef=doc(db,'studentSessions',user.uid);
  const prior=await getDoc(sessionRef);
  if(prior.exists()){
   const previous=prior.data().code;
   const p=await getDoc(doc(db,'participants',previous));
   if(!p.exists()||p.data().ownerUid!==user.uid)throw Error('Sessão desatualizada. Procure o professor.');
   code=previous;
  }else{
   for(const i of randomizedSlots()){
    const candidate=slot(i),participantRef=doc(db,'participants',candidate);
    try{
     const assigned=await runTransaction(db,async t=>{
      const session=await t.get(sessionRef);
      if(session.exists())return session.data().code;
      // Regra permite consultar uma vaga vazia ou a própria vaga; nunca ler dados de outro aluno.
      const occupied=await t.get(participantRef);
      if(occupied.exists())throw Error('vaga-ocupada');
      t.set(sessionRef,{code:candidate,createdAt:serverTimestamp()});
      t.set(participantRef,{ownerUid:user.uid,started:{},completed:{},createdAt:serverTimestamp()});
      return candidate;
     });
     code=assigned;break;
    }catch(e){if(e.code==='permission-denied'||e.message==='vaga-ocupada'||e.code==='aborted')continue;throw e}
   }
   if(!code)throw Error('Não foi possível reservar uma vaga. Pode haver 60 participantes registrados. Procure o professor.');
  }
  $('portalCodeLabel').textContent=code;
  await updateDoc(doc(db,'participants',code),{['started.'+lab]:serverTimestamp()});
  started=true;
  status('Código '+code+' ativo. Início registrado.');
  if(completed)await saveCompletion();
 }catch(e){status('Registro não realizado: '+(e.message||e),true)}
 finally{registering=false}
}
async function saveCompletion(){if(!started||!code||saving)return;saving=true;try{
 await updateDoc(doc(db,'participants',code),{['completed.'+lab]:serverTimestamp()});
 status('Atividade concluída e registrada: '+lab.toUpperCase()+' · '+code+'.');
}catch(e){status('Atividade concluída nesta página, mas não registrada: '+e.message,true)}finally{saving=false}}
window.labComplete=()=>{completed=true;void saveCompletion()};
onAuthStateChanged(auth,u=>{if(!u){signInAnonymously(auth).catch(e=>status('Falha na autenticação: '+e.message,true))}else if(u.isAnonymous){void enroll(u)}else{status('Este navegador está conectado como professor. Teste como aluno em janela anônima.',true)}});
