import { useState, useEffect } from "react";
import { supabase, supabaseConfigError } from "./supabaseClient";

function App() {

  // 2. INSERT THIS SNIPPET RIGHT HERE
  useEffect(() => {
    const hash = window.location.hash;

    if (hash.includes('access_token')) {
      supabase.auth.getSession().then(({ data }) => {
        console.log('Session restored:', data.session);
      });
    }
  }, []);

  // 3. Your existing code continues below
  return (
    <>
      {/* your existing JSX */}
    </>
  );
}

export default App;


const S = {
  bg:"#0d1a0e",surface:"#132016",card:"#1a2b1c",cardBorder:"#2a3f2c",
  accent:"#4ade80",accentDim:"#22c55e",accentSubtle:"#1a3321",
  gold:"#f5c842",text:"#e8f0e9",textMuted:"#7a9e7e",textDim:"#4a6b4e",
  danger:"#f87171",dangerBg:"#2d1515",warning:"#fb923c",warningBg:"#2d1a0a",
  info:"#60a5fa",infoBg:"#0d1f35",
};

const PAIRING_OPTIONS=[
  {value:"balanced",label:"Balanced — matched by handicap"},
  {value:"blindDraw",label:"Blind Draw — random assignment"},
  {value:"system",label:"System Pairing — GHIN-based"},
  {value:"none",label:"None — admin assigns manually"},
];

const RECURRENCE_OPTIONS=[
  {value:"weekly",label:"Weekly"},
  {value:"biweekly",label:"Every 2 weeks"},
  {value:"monthly",label:"Monthly"},
  {value:"yearly",label:"Yearly"},
];

const WEEKDAYS=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];

// ── helpers ──────────────────────────────────────────────────────────────────
const uid=()=>crypto.randomUUID();
const fullName=u=>`${u.firstName} ${u.lastName}`;
const initials=u=>`${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
const getMem=(group,userId)=>group.memberships.find(m=>m.userId===userId);
const canEdit=(group,userId)=>["superadmin","admin"].includes(getMem(group,userId)?.role);
const isSA=(group,userId)=>getMem(group,userId)?.role==="superadmin";
const getUser=(users,id)=>users.find(u=>u.id===id);
const getLoc=(group,id)=>group.locations.find(l=>l.id===id);
const groupGames=(games,gid)=>games.filter(g=>g.groupId===gid);

// ── DB ↔ UI transforms ────────────────────────────────────────────────────────
 function formatDbDate(d){
  if(!d)return"";
  // "2025-06-07" → "June 7, 2025"
  const dt=new Date(d+"T12:00:00Z");
  return dt.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
}
function formatDbTime(t){
  if(!t)return"8:00 AM";
  const m=t.match(/(\d+):(\d+)/);
  if(!m)return t;
  let h=parseInt(m[1]),mn=parseInt(m[2]);
  const ap=h>=12?"PM":"AM";
  return`${h%12||12}:${String(mn).padStart(2,"0")} ${ap}`;
}
function parseUiDate(s){
  if(!s)return null;
  const d=new Date(s);
  return isNaN(d.getTime())?null:d.toISOString().split("T")[0];
}
function parseUiTime(s){
  if(!s)return null;
  const m=s.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if(!m)return null;
  let h=parseInt(m[1]);
  const mn=parseInt(m[2]),isPM=m[3].toUpperCase()==="PM";
  if(isPM&&h!==12)h+=12;
  if(!isPM&&h===12)h=0;
  return`${String(h).padStart(2,"0")}:${String(mn).padStart(2,"0")}:00`;
}
const toUiUser=row=>({
  id:row.id,
  firstName:row.first_name||"",
  lastName:row.last_name||"",
  email:row.email||"",
  phone:row.phone||"",
  handicap:Number(row.handicap)||0,
  ghin:row.ghin||"",
});
function parseTeeTimeContact(raw){
  try{return JSON.parse(raw||"{}");}catch{return{name:"",email:"",phone:""};}
}
const toUiLocation=row=>({
  id:row.location_id,
  name:row.name||"",
  address:row.address||"",
  lat:33.5,lng:-84.5,
  teeTimeContact:parseTeeTimeContact(row.tee_time_contact),
});
function parseResponse(raw){
  if(!raw)return null;
  if(typeof raw==="object")return raw;
  try{return JSON.parse(raw);}catch{return null;}
}
const toUiTTR=row=>({
  id:String(row.response_token_hash||uid()),
  sentAt:row.sent_at?new Date(row.sent_at).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}):"",
  requestedTimes:row.requested_time||[],
  players:0,
  toName:row.to_pro_shop_name||"",
  toEmail:row.to_pro_shop_email||"",
  status:row.status||"pending",
  response:parseResponse(row.response),
});
const toUiGame=(row,regs,ttrs)=>({
  id:row.id,
  groupId:row.group_id,
  locationId:row.location_id,
  day:Array.isArray(row.day_of_week)?row.day_of_week[0]:row.day_of_week||"",
  date:formatDbDate(row.scheduled_date),
  time:formatDbTime(row.first_tee_time),
  description:row.description||"",
  rules:row.rules||"",
  pairingMethod:Array.isArray(row.pairing_method)?row.pairing_method[0]:row.pairing_method||"balanced",
  assignFoursomes:row.assign_players||false,
  maxPlayers:Number(row.max_players)||16,
  recurring:row.recurring||false,
  recurrence:row.recurrence||null,
  registrations:(regs||[]).filter(r=>r.game_id===row.id&&r.status?.includes("registered")).map(r=>r.user_id),
  waitlist:(regs||[]).filter(r=>r.game_id===row.id&&r.status?.includes("waitlisted")).sort((a,b)=>(a.position||0)-(b.position||0)).map(r=>r.user_id),
  teeTimeRequests:(ttrs||[]).filter(t=>t.game_id===row.id).map(toUiTTR),
});
const toDbGame=game=>({
  id:game.id,
  group_id:game.groupId,
  location_id:game.locationId||null,
  description:game.description||null,
  rules:game.rules||null,
  max_players:game.maxPlayers,
  pairing_method:[game.pairingMethod],
  assign_players:game.assignFoursomes,
  recurring:game.recurring,
  recurrence:game.recurrence||null,
  day_of_week:[game.day],
  first_tee_time:parseUiTime(game.time),
  scheduled_date:parseUiDate(game.date),
  is_active:true,
});
const toDbLocation=(loc,groupId)=>({
  location_id:loc.id,
  group_id:groupId,
  name:loc.name,
  address:loc.address||"",
  tee_time_contact:JSON.stringify(loc.teeTimeContact||{}),
  is_active:true,
});

// ── shared UI ─────────────────────────────────────────────────────────────────
const Badge=({children,color=S.accent,bg=S.accentSubtle})=>(
  <span style={{display:"inline-flex",alignItems:"center",padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:600,letterSpacing:"0.04em",color,background:bg,border:`1px solid ${color}22`,textTransform:"uppercase"}}>{children}</span>
);
const RoleBadge=({role})=>{
  const m={superadmin:[S.gold,"#2a2000","Owner"],admin:[S.info,S.infoBg,"Admin"],player:[S.textMuted,S.surface,"Player"]};
  const [c,bg,label]=m[role]||m.player;
  return <Badge color={c} bg={bg}>{label}</Badge>;
};
const Btn=({children,onClick,variant="primary",small,disabled,full,style:sx})=>{
  const v={primary:{background:S.accent,color:"#0d1a0e",border:"none"},secondary:{background:"transparent",color:S.accent,border:`1px solid ${S.accent}55`},danger:{background:"transparent",color:S.danger,border:`1px solid ${S.danger}55`},gold:{background:S.gold,color:"#1a1200",border:"none"},ghost:{background:S.accentSubtle,color:S.accent,border:`1px solid ${S.accent}33`},info:{background:S.infoBg,color:S.info,border:`1px solid ${S.info}44`}};
  return <button onClick={onClick} disabled={disabled} style={{...v[variant],padding:small?"6px 14px":"9px 20px",borderRadius:8,fontSize:small?12:14,fontWeight:600,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.45:1,transition:"all 0.15s",fontFamily:"inherit",whiteSpace:"nowrap",width:full?"100%":"auto",...sx}}>{children}</button>;
};
const Inp=({label,value,onChange,placeholder,type="text",required,hint,error})=>(
  <div style={{marginBottom:14}}>
    {label&&<label style={{display:"block",fontSize:12,fontWeight:600,color:S.textMuted,marginBottom:5,letterSpacing:"0.05em",textTransform:"uppercase"}}>{label}{required&&<span style={{color:S.accent,marginLeft:3}}>*</span>}</label>}
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{width:"100%",background:S.surface,border:`1px solid ${error?S.danger:S.cardBorder}`,borderRadius:8,padding:"9px 12px",color:S.text,fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}
      onFocus={e=>e.target.style.borderColor=error?S.danger:S.accent}
      onBlur={e=>e.target.style.borderColor=error?S.danger:S.cardBorder}/>
    {hint&&<p style={{margin:"4px 0 0",fontSize:11,color:S.textDim}}>{hint}</p>}
    {error&&<p style={{margin:"4px 0 0",fontSize:11,color:S.danger}}>{error}</p>}
  </div>
);
const Sel=({label,value,onChange,options})=>(
  <div style={{marginBottom:14}}>
    {label&&<label style={{display:"block",fontSize:12,fontWeight:600,color:S.textMuted,marginBottom:5,letterSpacing:"0.05em",textTransform:"uppercase"}}>{label}</label>}
    <select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:S.surface,border:`1px solid ${S.cardBorder}`,borderRadius:8,padding:"9px 12px",color:S.text,fontSize:14,fontFamily:"inherit",outline:"none",cursor:"pointer"}}>
      {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);
const Tog=({label,value,onChange,hint})=>(
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,padding:"10px 0",borderBottom:`1px solid ${S.cardBorder}33`}}>
    <div><div style={{fontSize:14,color:S.text,fontWeight:500}}>{label}</div>{hint&&<div style={{fontSize:12,color:S.textMuted,marginTop:2}}>{hint}</div>}</div>
    <div onClick={()=>onChange(!value)} style={{width:44,height:24,borderRadius:12,background:value?S.accent:S.cardBorder,position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0}}>
      <div style={{position:"absolute",top:3,left:value?23:3,width:18,height:18,borderRadius:9,background:value?"#0d1a0e":S.textMuted,transition:"left 0.2s"}}/>
    </div>
  </div>
);
const Card=({children,style:sx})=>(
  <div style={{background:S.card,border:`1px solid ${S.cardBorder}`,borderRadius:14,padding:"20px 22px",...sx}}>{children}</div>
);
const SecTitle=({children,action})=>(
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
    <h3 style={{margin:0,fontSize:11,fontWeight:700,color:S.textMuted,letterSpacing:"0.1em",textTransform:"uppercase"}}>{children}</h3>
    {action}
  </div>
);
const Avatar=({user,size=36})=>(
  <div style={{width:size,height:size,borderRadius:size*0.25,background:S.accentSubtle,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.35,fontWeight:700,color:S.accent,flexShrink:0}}>{initials(user)}</div>
);
const Divider=()=><div style={{height:1,background:S.cardBorder,margin:"16px 0"}}/>;
const TA=({label,value,onChange,rows=3})=>(
  <div style={{marginBottom:14}}>
    {label&&<label style={{display:"block",fontSize:12,fontWeight:600,color:S.textMuted,marginBottom:5,letterSpacing:"0.05em",textTransform:"uppercase"}}>{label}</label>}
    <textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows}
      style={{width:"100%",background:S.surface,border:`1px solid ${S.cardBorder}`,borderRadius:8,padding:"9px 12px",color:S.text,fontSize:13,fontFamily:"inherit",resize:"vertical",outline:"none",boxSizing:"border-box"}}
      onFocus={e=>e.target.style.borderColor=S.accent} onBlur={e=>e.target.style.borderColor=S.cardBorder}/>
  </div>
);

const SetupErrorPage=()=>(
  <div style={{minHeight:"100vh",background:S.bg,color:S.text,fontFamily:"'DM Sans','Segoe UI',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <Card style={{maxWidth:520,width:"100%"}}>
      <div style={{fontSize:24,fontWeight:800,letterSpacing:"-0.03em",marginBottom:6}}>LinksInvite</div>
      <h1 style={{margin:"0 0 8px",fontSize:20}}>App setup needed</h1>
      <p style={{margin:"0 0 14px",fontSize:14,color:S.textMuted,lineHeight:1.6}}>
        The login and registration screen cannot load because the public Supabase environment variables are missing from this deployment.
      </p>
      <div style={{background:S.surface,border:`1px solid ${S.cardBorder}`,borderRadius:8,padding:"10px 12px",fontSize:13,color:S.textMuted,lineHeight:1.7}}>
        Add <strong style={{color:S.text}}>VITE_SUPABASE_URL</strong> and <strong style={{color:S.text}}>VITE_SUPABASE_ANON_KEY</strong> in Vercel, then redeploy.
      </div>
      {supabaseConfigError&&<p style={{margin:"12px 0 0",fontSize:12,color:S.danger}}>{supabaseConfigError}</p>}
    </Card>
  </div>
);

// ── PUBLIC TEE TIME RESPONSE PAGE ─────────────────────────────────────────────
const PublicTeeTimeResponsePage=({token})=>{
  const [request,setRequest]=useState(null);
  const [type,setType]=useState("confirmed");
  const [confirmedTime,setConfirmedTime]=useState("");
  const [alternateTimes,setAlternateTimes]=useState("");
  const [note,setNote]=useState("");
  const [loading,setLoading]=useState(true);
  const [submitting,setSubmitting]=useState(false);
  const [submitted,setSubmitted]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    let cancelled=false;
    const load=async()=>{
      try{
        const res=await fetch(`/api/tee_time_requests/respond?token=${encodeURIComponent(token)}`);
        const body=await res.json();
        if(!res.ok)throw new Error(body.error||"Unable to load tee-time request");
        if(cancelled)return;
        setRequest(body.data);
        setConfirmedTime(body.data.requestedTimes?.[0]||"");
        if(body.data.status==="responded")setSubmitted(true);
      }catch(err){
        if(!cancelled)setError(err.message);
      }finally{
        if(!cancelled)setLoading(false);
      }
    };
    load();
    return()=>{cancelled=true;};
  },[token]);

  const submit=async()=>{
    setSubmitting(true);
    setError("");
    try{
      const times=alternateTimes.split(",").map(t=>t.trim()).filter(Boolean);
      const res=await fetch("/api/tee_time_requests/respond",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({token,type,confirmedTime,alternateTimes:times,note}),
      });
      const body=await res.json();
      if(!res.ok)throw new Error(body.error||"Unable to submit response");
      setRequest(body.data);
      setSubmitted(true);
    }catch(err){
      setError(err.message);
    }finally{
      setSubmitting(false);
    }
  };

  const requestedTimes=request?.requestedTimes||[];

  return(
    <div style={{minHeight:"100vh",background:S.bg,color:S.text,fontFamily:"'DM Sans','Segoe UI',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{width:"100%",maxWidth:560}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:24,fontWeight:800,letterSpacing:"-0.03em"}}>LinksInvite</div>
          <div style={{fontSize:13,color:S.textMuted,marginTop:4}}>Tee Time Response</div>
        </div>
        <Card>
          {loading&&<p style={{margin:0,color:S.textMuted,textAlign:"center"}}>Loading request...</p>}
          {!loading&&error&&!request&&(
            <div>
              <h1 style={{margin:"0 0 8px",fontSize:20}}>Unable to open this link</h1>
              <p style={{margin:0,color:S.danger,lineHeight:1.6}}>{error}</p>
            </div>
          )}
          {!loading&&request&&submitted&&(
            <div style={{textAlign:"center"}}>
              <h1 style={{margin:"0 0 8px",fontSize:20,color:S.accent}}>Response received</h1>
              <p style={{margin:0,color:S.textMuted,lineHeight:1.6}}>Thank you. The group administrator has your tee-time response.</p>
            </div>
          )}
          {!loading&&request&&!submitted&&(
            <>
              <h1 style={{margin:"0 0 6px",fontSize:20}}>Confirm tee times</h1>
              <p style={{margin:"0 0 18px",fontSize:13,color:S.textMuted,lineHeight:1.6}}>
                {request.toProShopName?`Hello ${request.toProShopName}. `:""}Please confirm one of the requested times or suggest alternates.
              </p>
              <SecTitle>Requested Times</SecTitle>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18}}>
                {requestedTimes.map(time=><Badge key={time}>{time}</Badge>)}
              </div>
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                {[["confirmed","Confirm a time"],["alternates","Suggest alternates"]].map(([value,label])=>(
                  <button key={value} onClick={()=>setType(value)} style={{flex:1,padding:"9px 10px",borderRadius:8,border:`1px solid ${type===value?S.accent:S.cardBorder}`,background:type===value?S.accentSubtle:"transparent",color:type===value?S.accent:S.textMuted,fontFamily:"inherit",fontSize:13,fontWeight:600,cursor:"pointer"}}>{label}</button>
                ))}
              </div>
              {type==="confirmed"?(
                <Sel label="Confirmed Tee Time" value={confirmedTime} onChange={setConfirmedTime} options={requestedTimes.map(time=>({value:time,label:time}))}/>
              ):(
                <Inp label="Alternate Tee Times" value={alternateTimes} onChange={setAlternateTimes} placeholder="9:00 AM, 9:10 AM, 9:20 AM" hint="Separate multiple times with commas"/>
              )}
              <TA label="Note (optional)" value={note} onChange={setNote} rows={3}/>
              {error&&<p style={{margin:"0 0 12px",fontSize:12,color:S.danger}}>{error}</p>}
              <Btn full onClick={submit} disabled={submitting||(type==="confirmed"?!confirmedTime:!alternateTimes.trim())}>
                {submitting?"Submitting...":"Send Response"}
              </Btn>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

// ── AUTH ──────────────────────────────────────────────────────────────────────
const AuthPage=()=>{
  const [mode,setMode]=useState("login");
  const [step,setStep]=useState(1);
  const [f,setF]=useState({firstName:"",lastName:"",email:"",phone:"",password:"",handicap:"",ghin:""});
  const [g,setG]=useState({name:"",description:"",locName:"",locAddress:""});
  const [intent,setIntent]=useState("create");
  const [joinCode,setJoinCode]=useState("");
  const [errors,setErrors]=useState({});
  const [authLoading,setAuthLoading]=useState(false);
  const [authError,setAuthError]=useState("");
  const [confirmPending,setConfirmPending]=useState(false);
  const sf=k=>v=>setF(p=>({...p,[k]:v}));
  const sg=k=>v=>setG(p=>({...p,[k]:v}));

  const v1=()=>{
    const e={};
    if(!f.firstName.trim())e.firstName="Required";
    if(!f.lastName.trim())e.lastName="Required";
    if(!f.email.includes("@"))e.email="Valid email required";
    if(!f.phone.trim())e.phone="Required";
    if(!f.handicap||isNaN(+f.handicap))e.handicap="Must be a number";
    return e;
  };

  const handleLogin=async()=>{
    if(!f.email||!f.password){setAuthError("Email and password are required.");return;}
    setAuthLoading(true);setAuthError("");
    try{
      const{error}=await supabase.auth.signInWithPassword({email:f.email,password:f.password});
      if(error)throw error;
      // onAuthStateChange in App root takes over
    }catch(err){
      setAuthError(err.message);
    }finally{
      setAuthLoading(false);
    }
  };

  const handleRegister=async()=>{
    const e=v1();
    if(Object.keys(e).length){setErrors(e);return;}
    if(intent==="create"&&!g.name.trim()){setErrors({gname:"Required"});return;}
    if(intent==="join"&&!joinCode.trim()){setErrors({join:"Enter a group name or invite code"});return;}
    if(!f.password||f.password.length<6){setErrors({password:"Password must be at least 6 characters"});return;}
    setAuthLoading(true);setAuthError("");
    try{
      const{data:authData,error:signUpError}=await supabase.auth.signUp({email:f.email,password:f.password});
      if(signUpError)throw signUpError;
      const authUserId=authData.user?.id;
      if(!authUserId)throw new Error("Failed to create account — please try again");

      const{error:profileError}=await supabase.from("users").insert({
        id:authUserId,first_name:f.firstName,last_name:f.lastName,
        email:f.email,phone:f.phone,handicap:parseFloat(f.handicap)||0,ghin:f.ghin||null,
      });
      if(profileError)throw profileError;

      if(intent==="create"){
        const{data:groupData,error:groupError}=await supabase.from("groups").insert({
          name:g.name,description:g.description||"",is_active:true,
        }).select().single();
        if(groupError)throw groupError;

        if(g.locName){
          await supabase.from("locations").insert({
            group_id:groupData.id,name:g.locName,address:g.locAddress||"",
            tee_time_contact:JSON.stringify({name:"",email:"",phone:""}),is_active:true,
          });
        }
        await supabase.from("group_memberships").insert({
          group_id:groupData.id,user_id:authUserId,role:"superadmin",
        });
      }else{
        const{data:groupData,error:groupFindError}=await supabase.from("groups")
          .select("id").ilike("name",`%${joinCode}%`).eq("is_active",true).limit(1).single();
        if(groupFindError||!groupData){setErrors({join:"Group not found. Check the name and try again."});setAuthLoading(false);return;}
        await supabase.from("group_memberships").insert({
          group_id:groupData.id,user_id:authUserId,role:"player",
        });
      }

      if(!authData.session){
        setConfirmPending(true);
      }
    }catch(err){
      setAuthError(err.message);
    }finally{
      setAuthLoading(false);
    }
  };

  if(confirmPending){
    return(
      <div style={{minHeight:"100vh",background:S.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
        <div style={{width:"100%",maxWidth:440,textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:16}}>📧</div>
          <div style={{fontSize:20,fontWeight:700,color:S.accent,marginBottom:8}}>Check your email</div>
          <div style={{fontSize:14,color:S.textMuted,lineHeight:1.7}}>
            We sent a confirmation link to <strong style={{color:S.text}}>{f.email}</strong>.<br/>
            Click it to activate your account, then come back to sign in.
          </div>
          <Btn style={{marginTop:24}} onClick={()=>{setConfirmPending(false);setMode("login");}}>Back to sign in</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",background:S.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{width:"100%",maxWidth:440}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:56,height:56,borderRadius:16,background:S.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 12px"}}>⛳</div>
          <div style={{fontSize:24,fontWeight:800,color:S.text,letterSpacing:"-0.03em"}}>LinksInvite</div>
          <div style={{fontSize:13,color:S.textMuted,marginTop:4}}>Weekly Golf Coordinator</div>
        </div>
        <Card>
          <div style={{display:"flex",background:S.surface,borderRadius:10,padding:3,marginBottom:24}}>
            {["login","register"].map(m=>(
              <button key={m} onClick={()=>{setMode(m);setStep(1);setErrors({});setAuthError("");}} style={{flex:1,padding:"8px 0",borderRadius:8,border:"none",fontFamily:"inherit",fontSize:13,fontWeight:600,cursor:"pointer",background:mode===m?S.card:"transparent",color:mode===m?S.accent:S.textMuted,textTransform:"capitalize"}}>{m}</button>
            ))}
          </div>

          {authError&&<div style={{background:S.dangerBg,border:`1px solid ${S.danger}44`,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13,color:S.danger}}>{authError}</div>}

          {mode==="login"&&(
            <div>
              <Inp label="Email" value={f.email} onChange={sf("email")} placeholder="you@example.com" type="email"/>
              <Inp label="Password" value={f.password} onChange={sf("password")} placeholder="••••••••" type="password"/>
              <Btn full onClick={handleLogin} disabled={authLoading}>{authLoading?"Signing in…":"Sign in"}</Btn>
            </div>
          )}

          {mode==="register"&&step===1&&(
            <div>
              <div style={{fontSize:12,color:S.textMuted,marginBottom:16}}>Step 1 of 2 — Your account</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <Inp label="First name" value={f.firstName} onChange={sf("firstName")} required placeholder="James" error={errors.firstName}/>
                <Inp label="Last name" value={f.lastName} onChange={sf("lastName")} required placeholder="Harrington" error={errors.lastName}/>
              </div>
              <Inp label="Email" value={f.email} onChange={sf("email")} required placeholder="you@example.com" type="email" error={errors.email}/>
              <Inp label="Phone" value={f.phone} onChange={sf("phone")} required placeholder="770-555-0000" type="tel" error={errors.phone}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <Inp label="Handicap" value={f.handicap} onChange={sf("handicap")} required placeholder="15.4" type="number" error={errors.handicap}/>
                <Inp label="GHIN (optional)" value={f.ghin} onChange={sf("ghin")} placeholder="7-digit ID"/>
              </div>
              <Inp label="Password" value={f.password} onChange={sf("password")} required placeholder="Min 6 characters" type="password" error={errors.password}/>
              <Btn full onClick={()=>{const e=v1();if(Object.keys(e).length){setErrors(e);return;}setErrors({});setStep(2);}}>Continue →</Btn>
            </div>
          )}

          {mode==="register"&&step===2&&(
            <div>
              <div style={{fontSize:12,color:S.textMuted,marginBottom:16}}>Step 2 of 2 — Your group</div>
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                {["create","join"].map(i=>(
                  <button key={i} onClick={()=>setIntent(i)} style={{flex:1,padding:"9px 0",borderRadius:8,border:`1px solid ${intent===i?S.accent:S.cardBorder}`,background:intent===i?S.accentSubtle:"transparent",color:intent===i?S.accent:S.textMuted,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                    {i==="create"?"➕ Create group":"🔗 Join group"}
                  </button>
                ))}
              </div>
              {intent==="create"&&(
                <>
                  <Inp label="Group name" value={g.name} onChange={sg("name")} required placeholder='"Newnan Saturday Crew"' error={errors.gname}/>
                  <Inp label="Description" value={g.description} onChange={sg("description")} placeholder="What's your group about?"/>
                  <Divider/>
                  <div style={{fontSize:12,color:S.textMuted,marginBottom:10}}>First home course</div>
                  <Inp label="Course name" value={g.locName} onChange={sg("locName")} placeholder="Newnan Country Club"/>
                  <Inp label="Address" value={g.locAddress} onChange={sg("locAddress")} placeholder="200 CC Dr, Newnan, GA"/>
                </>
              )}
              {intent==="join"&&(
                <Inp label="Group name or invite code" value={joinCode} onChange={setJoinCode} placeholder="Search by group name" error={errors.join} hint="Ask your admin for the code"/>
              )}
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <Btn variant="ghost" onClick={()=>setStep(1)}>← Back</Btn>
                <Btn full onClick={handleRegister} disabled={authLoading}>
                  {authLoading?"Creating account…":intent==="create"?"Create group & sign in":"Join & sign in"}
                </Btn>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

// ── NAV ───────────────────────────────────────────────────────────────────────
const TopNav=({page,setPage,user,group,groups,onGroupChange,onSignOut})=>{
  const [open,setOpen]=useState(false);
  const mem=group?getMem(group,user.id):null;
  const canEditGroup=group&&["superadmin","admin"].includes(mem?.role);
  return (
    <nav style={{background:S.surface,borderBottom:`1px solid ${S.cardBorder}`,padding:"0 20px",display:"flex",alignItems:"center",height:56,position:"sticky",top:0,zIndex:100,gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginRight:"auto"}}>
        <div style={{width:32,height:32,borderRadius:8,background:S.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>⛳</div>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:S.text,letterSpacing:"-0.02em"}}>LinksInvite</div>
          <div style={{fontSize:10,color:S.textMuted,letterSpacing:"0.05em",marginTop:-2}}>WEEKLY GOLF COORDINATOR</div>
        </div>
      </div>
      {groups.length>0&&(
        <select value={group?.id||""} onChange={e=>onGroupChange(e.target.value)} style={{background:S.card,border:`1px solid ${S.cardBorder}`,borderRadius:8,padding:"5px 10px",color:S.text,fontSize:12,fontFamily:"inherit",cursor:"pointer",maxWidth:180}}>
          {groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      )}
      <div style={{display:"flex",gap:2}}>
        {[{id:"splash",label:"Games"},{id:"profile",label:"Profile"},...(canEditGroup?[{id:"admin",label:"Admin"}]:[])].map(({id,label})=>(
          <button key={id} onClick={()=>setPage(id)} style={{background:page===id?S.accentSubtle:"transparent",border:"none",borderRadius:8,padding:"6px 12px",color:page===id?S.accent:S.textMuted,fontSize:13,fontWeight:page===id?600:400,cursor:"pointer",fontFamily:"inherit"}}>{label}</button>
        ))}
      </div>
      <div style={{position:"relative"}}>
        <div onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"4px 8px",borderRadius:8,background:open?S.card:"transparent"}}>
          <Avatar user={user} size={30}/>
          {mem&&<RoleBadge role={mem.role}/>}
        </div>
        {open&&(
          <div style={{position:"absolute",right:0,top:44,background:S.card,border:`1px solid ${S.cardBorder}`,borderRadius:10,padding:6,minWidth:160,zIndex:200}}>
            <div style={{padding:"6px 10px",fontSize:13,color:S.text,fontWeight:500}}>{fullName(user)}</div>
            <div style={{padding:"4px 10px",fontSize:11,color:S.textMuted}}>{user.email}</div>
            <Divider/>
            <button onClick={()=>{setOpen(false);setPage("profile");}} style={{width:"100%",textAlign:"left",padding:"8px 10px",background:"none",border:"none",color:S.text,fontSize:13,cursor:"pointer",fontFamily:"inherit",borderRadius:6}}>My Profile</button>
            <button onClick={onSignOut} style={{width:"100%",textAlign:"left",padding:"8px 10px",background:"none",border:"none",color:S.danger,fontSize:13,cursor:"pointer",fontFamily:"inherit",borderRadius:6}}>Sign out</button>
          </div>
        )}
      </div>
    </nav>
  );
};

// ── SPLASH ────────────────────────────────────────────────────────────────────
const WeatherWidget=({location})=>{
  const [wx,setWx]=useState(null);
  const [wxLoading,setWxLoading]=useState(false);

  useEffect(()=>{
    if(!location?.name)return;
    setWxLoading(true);
    fetch(`/api/weather?location=${encodeURIComponent(location.name+","+(location.address||""))}`)
      .then(r=>r.json())
      .then(d=>{if(d.days)setWx(d.days);})
      .catch(()=>{})
      .finally(()=>setWxLoading(false));
  },[location?.name]);

  const ratingColor=r=>r==="Excellent"?S.accent:r==="Hot"?S.gold:r==="Fair"?S.warning:S.danger;
  const ratingBg=r=>r==="Excellent"?S.accentSubtle:r==="Hot"?"#2a2000":r==="Fair"?S.warningBg:S.dangerBg;

  return (
    <Card style={{marginBottom:20}}>
      <SecTitle>3-Day Forecast{location?.name&&<span style={{fontWeight:400,color:S.textDim,marginLeft:6,fontSize:11}}>— {location.name}</span>}</SecTitle>
      {wxLoading&&<p style={{margin:0,fontSize:13,color:S.textMuted}}>Loading forecast…</p>}
      {!wxLoading&&!wx&&<p style={{margin:0,fontSize:13,color:S.textDim}}>Forecast unavailable</p>}
      {!wxLoading&&wx&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
          {wx.map((w,i)=>{
            const day=w.dayName?.slice(0,3)||"—";
            const tempParts=(w.temp||"").replace(/°F/g,"").split("/");
            const hi=(tempParts[0]||"").trim();
            const lo=(tempParts[1]||"").trim();
            const rain=parseInt(w.rainChance)||0;
            return(
              <div key={i} style={{background:S.surface,borderRadius:10,padding:"14px 12px",textAlign:"center",border:`1px solid ${i===0?S.accent+"55":S.cardBorder}`}}>
                <div style={{fontSize:11,fontWeight:700,color:i===0?S.accent:S.textMuted,letterSpacing:"0.08em",marginBottom:6}}>{day}</div>
                <div style={{fontSize:13,fontWeight:600,color:S.text,marginBottom:3}}>{hi} / {lo}</div>
                <div style={{fontSize:11,color:S.textMuted,marginBottom:8}}>{rain}% rain</div>
                <Badge color={ratingColor(w.playability)} bg={ratingBg(w.playability)}>{w.playability}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

const PlayerRow=({user,isWaitlist})=>(
  <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${S.cardBorder}33`}}>
    <Avatar user={user} size={32}/>
    <div style={{flex:1,fontSize:14,fontWeight:500,color:isWaitlist?S.textMuted:S.text}}>{fullName(user)}</div>
    <div style={{fontSize:12,color:S.textMuted}}>HCP <strong style={{color:S.text}}>{user.handicap}</strong></div>
    {isWaitlist&&<Badge color={S.warning} bg={S.warningBg}>Waitlist</Badge>}
  </div>
);

const GameCard=({game,group,user,users,onRegister})=>{
  const [expanded,setExpanded]=useState(false);
  const loc=getLoc(group,game.locationId);
  const isReg=game.registrations.includes(user.id);
  const isFull=game.registrations.length>=game.maxPlayers;
  const isWait=game.waitlist.includes(user.id);
  const spotsLeft=game.maxPlayers-game.registrations.length;
  const regUsers=game.registrations.map(id=>getUser(users,id)).filter(Boolean);
  const waitUsers=game.waitlist.map(id=>getUser(users,id)).filter(Boolean);
  return (
    <Card style={{marginBottom:20}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
            <h2 style={{margin:0,fontSize:20,fontWeight:700,color:S.text}}>{game.day}</h2>
            {isReg&&<Badge>Registered</Badge>}
            {isWait&&<Badge color={S.warning} bg={S.warningBg}>Waitlisted</Badge>}
            {isFull&&!isReg&&!isWait&&<Badge color={S.warning} bg={S.warningBg}>Full</Badge>}
          </div>
          <div style={{fontSize:13,color:S.textMuted}}>{game.date} · {game.time}</div>
          {loc&&<div style={{fontSize:12,color:S.textDim,marginTop:2}}>📍 {loc.name}</div>}
        </div>
        <Btn variant={isReg||isWait?"danger":isFull?"secondary":"primary"} onClick={()=>onRegister(game.id)} small>
          {isReg?"Unregister":isWait?"Leave Waitlist":isFull?"Join Waitlist":"Register"}
        </Btn>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        {[{v:game.registrations.length,l:"Registered",c:S.accent},{v:spotsLeft,l:"Open Slots",c:spotsLeft>3?S.text:S.warning},{v:game.waitlist.length,l:"Waitlist",c:S.gold}].map(({v,l,c})=>(
          <div key={l} style={{background:S.surface,borderRadius:8,padding:"8px 14px",flex:1,minWidth:70,textAlign:"center"}}>
            <div style={{fontSize:20,fontWeight:700,color:c}}>{v}</div>
            <div style={{fontSize:11,color:S.textMuted}}>{l}</div>
          </div>
        ))}
      </div>
      <p style={{margin:"0 0 14px",fontSize:13,color:S.textMuted,lineHeight:1.6}}>{game.description}</p>
      <div style={{borderTop:`1px solid ${S.cardBorder}`,paddingTop:14}}>
        <SecTitle>Who's Playing ({game.registrations.length}/{game.maxPlayers})</SecTitle>
        {regUsers.length===0?<p style={{margin:"0 0 8px",fontSize:13,color:S.textDim}}>No players yet — be the first to register.</p>:regUsers.map(u=><PlayerRow key={u.id} user={u}/>)}
      </div>
      {waitUsers.length>0&&(<div style={{marginTop:12}}><SecTitle>Waitlist</SecTitle>{waitUsers.map(u=><PlayerRow key={u.id} user={u} isWaitlist/>)}</div>)}
      <button onClick={()=>setExpanded(!expanded)} style={{background:"none",border:"none",color:S.accent,fontSize:12,fontWeight:600,cursor:"pointer",padding:"12px 0 4px",fontFamily:"inherit",display:"block",letterSpacing:"0.03em"}}>
        {expanded?"▲ Hide rules":"▼ View rules"}
      </button>
      {expanded&&(
        <div style={{background:S.surface,borderRadius:10,padding:"12px 14px",marginTop:6}}>
          <div style={{fontSize:11,fontWeight:700,color:S.textMuted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Rules</div>
          <p style={{margin:0,fontSize:13,color:S.textMuted,lineHeight:1.7}}>{game.rules}</p>
        </div>
      )}
    </Card>
  );
};

const SplashPage=({group,user,users,games,onRegister})=>{
  const myGames=groupGames(games,group.id);
  const primaryLoc=group.locations[0];
  return (
    <div style={{maxWidth:680,margin:"0 auto",padding:"24px 16px"}}>
      <div style={{marginBottom:24}}>
        <h1 style={{margin:"0 0 4px",fontSize:26,fontWeight:800,color:S.text,letterSpacing:"-0.03em"}}>{group.name}</h1>
        <p style={{margin:0,fontSize:14,color:S.textMuted}}>{group.description}</p>
      </div>
      {primaryLoc&&<WeatherWidget location={primaryLoc}/>}
      {myGames.length===0?<Card><p style={{color:S.textMuted,textAlign:"center",margin:0}}>No games scheduled yet.</p></Card>:myGames.map(g=><GameCard key={g.id} game={g} group={group} user={user} users={users} onRegister={onRegister}/>)}
    </div>
  );
};

// ── TEE TIME EMAIL MODAL ──────────────────────────────────────────────────────
const TeeTimeModal=({game,location,adminUser,group,onSend,onClose})=>{
  const contact=location?.teeTimeContact||{};
  const foursomes=Math.ceil(game.maxPlayers/4);
  const genTimes=()=>{
    const raw=game.time||"8:00 AM";
    const parts=raw.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if(!parts)return[game.time];
    let h=parseInt(parts[1]),mn=parseInt(parts[2]);
    const isPM=parts[3].toUpperCase()==="PM";
    let base=(isPM&&h!==12?h+12:(!isPM&&h===12?0:h))*60+mn;
    return Array.from({length:foursomes},(_,i)=>{
      const t=base+i*10;
      const hr=Math.floor(t/60)%12||12;
      const m2=String(t%60).padStart(2,"0");
      const ap=t%1440<720?"AM":"PM";
      return`${hr}:${m2} ${ap}`;
    });
  };
  const [times,setTimes]=useState(genTimes().join(", "));
  const [note,setNote]=useState("");
  const [toName,setToName]=useState(contact.name||"");
  const [toEmail,setToEmail]=useState(contact.email||"");
  const [tab,setTab]=useState("compose");
  const [sent,setSent]=useState(false);
  const [sending,setSending]=useState(false);
  const [sendError,setSendError]=useState("");
  const replyLink=`https://linksinvite.com/respond/${game.id}`;
  const preview=`Hi ${toName||"[Contact]"},\n\nI'm reaching out to reserve tee times for ${group.name}.\n\nGame details:\n  Date: ${game.date} (${game.day})\n  Players: ${game.maxPlayers} (${foursomes} foursomes)\n  Requested times: ${times}\n${note?`\nNotes: ${note}\n`:""}\nPlease confirm or suggest alternates:\n  → ${replyLink}\n\nThank you,\n${fullName(adminUser)}\n${adminUser.email} · ${adminUser.phone}`;

  const handleSend=async()=>{
    setSending(true);setSendError("");
    try{
      const requestedTimes=times.split(",").map(t=>t.trim()).filter(Boolean);
      const{data:{session}}=await supabase.auth.getSession();
      const headers={"Content-Type":"application/json"};
      if(session?.access_token)headers["Authorization"]=`Bearer ${session.access_token}`;
      const res=await fetch("/api/tee_times/request",{
        method:"POST",
        headers,
        body:JSON.stringify({gameId:game.id,requestedTimes,toProShopName:toName,toProShopEmail:toEmail}),
      });
      const body=await res.json();
      if(!res.ok)throw new Error(body.error||"Failed to send request");
      const sentAt=new Date().toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});
      onSend({
        id:String(body.data?.response_token_hash||uid()),
        sentAt,requestedTimes,players:game.maxPlayers,
        toName,toEmail,status:"pending",response:null,
      });
      setSent(true);
    }catch(err){
      setSendError(err.message);
    }finally{
      setSending(false);
    }
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:S.card,border:`1px solid ${S.cardBorder}`,borderRadius:16,width:"100%",maxWidth:580,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{padding:"18px 22px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:S.text}}>Request Tee Times</div>
            <div style={{fontSize:12,color:S.textMuted,marginTop:2}}>{location?.name} · {game.date}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:S.textMuted,fontSize:20,cursor:"pointer",padding:"0 4px"}}>✕</button>
        </div>
        {sent?(
          <div style={{padding:"32px 22px",textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:12}}>📧</div>
            <div style={{fontSize:16,fontWeight:700,color:S.accent,marginBottom:8}}>Request sent</div>
            <div style={{fontSize:13,color:S.textMuted,lineHeight:1.6}}>Request sent to <strong style={{color:S.text}}>{toEmail}</strong>.<br/>You'll be notified when they respond.</div>
            <Btn onClick={onClose} style={{marginTop:20}}>Done</Btn>
          </div>
        ):(
          <div style={{padding:"18px 22px"}}>
            <div style={{display:"flex",background:S.surface,borderRadius:8,padding:3,marginBottom:18}}>
              {["compose","preview"].map(t=>(
                <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"6px 0",borderRadius:6,border:"none",fontFamily:"inherit",fontSize:12,fontWeight:600,cursor:"pointer",background:tab===t?S.card:"transparent",color:tab===t?S.accent:S.textMuted,textTransform:"capitalize"}}>{t}</button>
              ))}
            </div>
            {tab==="compose"&&(
              <>
                {!contact.email&&(
                  <div style={{background:S.warningBg,border:`1px solid ${S.warning}44`,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:S.warning}}>
                    ⚠ No tee time contact saved for this location. Add one in the Locations tab.
                  </div>
                )}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <Inp label="Contact name" value={toName} onChange={setToName} placeholder="Pro shop contact"/>
                  <Inp label="Contact email" type="email" value={toEmail} onChange={setToEmail} placeholder="proshop@course.com" required/>
                </div>
                <Divider/>
                <div style={{background:S.surface,borderRadius:8,padding:"10px 12px",marginBottom:14,fontSize:12,color:S.textMuted}}>
                  {foursomes} foursome{foursomes!==1?"s":""} · {game.maxPlayers} players · starting {game.time}
                </div>
                <Inp label="Requested tee times (comma-separated)" value={times} onChange={setTimes} hint="One per foursome — edit as needed"/>
                <TA label="Additional notes (optional)" value={note} onChange={setNote} rows={2}/>
                <div style={{background:S.infoBg,border:`1px solid ${S.info}33`,borderRadius:8,padding:"10px 14px",fontSize:12,color:S.info,marginBottom:18,lineHeight:1.6}}>
                  📩 The email includes a <strong>one-click response link</strong>. The contact can confirm or offer alternates — response goes straight to your admin inbox.
                </div>
                {sendError&&<div style={{background:S.dangerBg,border:`1px solid ${S.danger}44`,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:S.danger}}>{sendError}</div>}
                <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                  <Btn variant="ghost" small onClick={()=>setTab("preview")}>Preview</Btn>
                  <Btn small onClick={handleSend} disabled={sending||!toEmail.includes("@")}>{sending?"Sending…":"Send Request"}</Btn>
                </div>
              </>
            )}
            {tab==="preview"&&(
              <>
                <div style={{background:S.surface,borderRadius:10,padding:"16px 18px",fontFamily:"monospace",fontSize:12,color:S.text,lineHeight:1.8,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
                  <div style={{marginBottom:12,paddingBottom:12,borderBottom:`1px solid ${S.cardBorder}`}}>
                    <span style={{color:S.textMuted}}>To: </span>{toName?`${toName} <${toEmail}>`:toEmail||"—"}{"\n"}
                    <span style={{color:S.textMuted}}>From: </span>{fullName(adminUser)} &lt;{adminUser.email}&gt;{"\n"}
                    <span style={{color:S.textMuted}}>Subject: </span>Tee Time Request — {group.name} · {game.date}
                  </div>
                  <span style={{color:S.textMuted,fontFamily:"inherit",fontSize:11}}>{preview}</span>
                </div>
                {sendError&&<div style={{background:S.dangerBg,border:`1px solid ${S.danger}44`,borderRadius:8,padding:"10px 14px",marginTop:14,fontSize:12,color:S.danger}}>{sendError}</div>}
                <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:14}}>
                  <Btn variant="ghost" small onClick={()=>setTab("compose")}>← Edit</Btn>
                  <Btn small onClick={handleSend} disabled={sending||!toEmail.includes("@")}>{sending?"Sending…":"Send Request"}</Btn>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── TEE TIME REQUESTS PANEL ───────────────────────────────────────────────────
const TeeTimePanel=({game,location,onSimulateResponse})=>{
  const reqs=game.teeTimeRequests||[];
  if(reqs.length===0)return null;
  return (
    <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${S.cardBorder}33`}}>
      <div style={{fontSize:11,fontWeight:700,color:S.textMuted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>Tee Time Requests</div>
      {reqs.map(req=>(
        <div key={req.id} style={{background:S.surface,borderRadius:10,padding:"12px 14px",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,flexWrap:"wrap",marginBottom:8}}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:S.text}}>
                Sent to {req.toName||location?.teeTimeContact?.name||"Pro Shop"}
                {req.toEmail&&<span style={{fontWeight:400,color:S.textMuted}}> · {req.toEmail}</span>}
              </div>
              <div style={{fontSize:11,color:S.textDim,marginTop:2}}>{req.sentAt}</div>
            </div>
            <Badge color={req.status==="responded"?S.accent:S.warning} bg={req.status==="responded"?S.accentSubtle:S.warningBg}>
              {req.status==="responded"?"Responded":"Awaiting reply"}
            </Badge>
          </div>
          <div style={{fontSize:12,color:S.textMuted,marginBottom:req.response?10:0}}>
            Requested: {req.requestedTimes?.join(" · ")} · {req.players} players
          </div>
          {req.response&&(
            <div style={{background:req.response.type==="confirmed"?S.accentSubtle:S.warningBg,border:`1px solid ${req.response.type==="confirmed"?S.accent+"44":S.warning+"44"}`,borderRadius:8,padding:"10px 12px"}}>
              <div style={{fontSize:12,fontWeight:600,color:req.response.type==="confirmed"?S.accent:S.warning,marginBottom:4}}>
                {req.response.type==="confirmed"?"✓ Confirmed":"↻ Alternate times offered"}
                <span style={{fontWeight:400,color:S.textMuted,marginLeft:8}}>{req.response.respondedAt}</span>
              </div>
              {req.response.confirmedTime&&<div style={{fontSize:13,color:S.text,marginBottom:4}}>Tee time: <strong>{req.response.confirmedTime}</strong></div>}
              {req.response.alternateTimes&&<div style={{fontSize:13,color:S.text,marginBottom:4}}>Alternates: <strong>{req.response.alternateTimes.join(", ")}</strong></div>}
              {req.response.note&&<div style={{fontSize:12,color:S.textMuted,marginTop:4,lineHeight:1.5}}>"{req.response.note}"</div>}
            </div>
          )}
          {req.status==="pending"&&(
            <button onClick={()=>onSimulateResponse(game.id,req.id)} style={{marginTop:8,background:"none",border:`1px dashed ${S.textDim}`,borderRadius:6,padding:"4px 10px",fontSize:11,color:S.textDim,cursor:"pointer",fontFamily:"inherit"}}>
              ↻ Simulate response (demo)
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

// ── LOCATIONS TAB ─────────────────────────────────────────────────────────────
const ContactForm=({location,onSave,onCancel})=>{
  const [c,setC]=useState(location.teeTimeContact||{name:"",email:"",phone:""});
  return (
    <div style={{borderTop:`1px solid ${S.accent}44`,padding:"14px 16px",background:`${S.accentSubtle}55`}}>
      <div style={{fontSize:12,fontWeight:600,color:S.accent,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>Edit Tee Time Contact</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        <Inp label="Name" value={c.name} onChange={v=>setC(x=>({...x,name:v}))} placeholder="Bobby Stafford"/>
        <Inp label="Email" type="email" value={c.email} onChange={v=>setC(x=>({...x,email:v}))} placeholder="pro@course.com"/>
        <Inp label="Phone" value={c.phone} onChange={v=>setC(x=>({...x,phone:v}))} placeholder="770-253-4400"/>
      </div>
      <div style={{fontSize:11,color:S.textDim,marginBottom:10}}>This contact receives automated tee time request emails and responds directly to your admin inbox.</div>
      <div style={{display:"flex",gap:8}}><Btn variant="ghost" small onClick={onCancel}>Cancel</Btn><Btn small onClick={()=>onSave(c)}>Save Contact</Btn></div>
    </div>
  );
};

const LocationsTab=({group,onUpdate,superAdmin})=>{
  const [adding,setAdding]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [newLoc,setNewLoc]=useState({name:"",address:"",teeTimeContact:{name:"",email:"",phone:""}});

  const handleAdd=()=>{
    if(!newLoc.name.trim())return;
    onUpdate({...group,locations:[...group.locations,{id:uid(),name:newLoc.name,address:newLoc.address,lat:33.5,lng:-84.5,teeTimeContact:newLoc.teeTimeContact}]});
    setNewLoc({name:"",address:"",teeTimeContact:{name:"",email:"",phone:""}});
    setAdding(false);
  };

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div style={{fontSize:13,color:S.textMuted}}>{group.locations.length} location{group.locations.length!==1?"s":""}</div>
        {superAdmin&&<Btn variant="ghost" small onClick={()=>setAdding(a=>!a)}>+ Add Location</Btn>}
      </div>

      {adding&&(
        <Card style={{marginBottom:16,border:`1px solid ${S.accent}44`}}>
          <div style={{fontSize:13,fontWeight:600,color:S.text,marginBottom:12}}>New Location</div>
          <Inp label="Course name" value={newLoc.name} onChange={v=>setNewLoc(l=>({...l,name:v}))} required placeholder="Newnan Country Club"/>
          <Inp label="Address" value={newLoc.address} onChange={v=>setNewLoc(l=>({...l,address:v}))} placeholder="200 CC Dr, Newnan, GA"/>
          <Divider/>
          <div style={{fontSize:12,fontWeight:600,color:S.textMuted,letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:10}}>Tee Time Contact</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Inp label="Contact name" value={newLoc.teeTimeContact.name} onChange={v=>setNewLoc(l=>({...l,teeTimeContact:{...l.teeTimeContact,name:v}}))} placeholder="Pro shop contact"/>
            <Inp label="Phone" value={newLoc.teeTimeContact.phone} onChange={v=>setNewLoc(l=>({...l,teeTimeContact:{...l.teeTimeContact,phone:v}}))} placeholder="770-253-4400"/>
          </div>
          <Inp label="Email" type="email" value={newLoc.teeTimeContact.email} onChange={v=>setNewLoc(l=>({...l,teeTimeContact:{...l.teeTimeContact,email:v}}))} placeholder="proshop@course.com" hint="Used for automated tee time request emails"/>
          <div style={{display:"flex",gap:8}}>
            <Btn variant="ghost" small onClick={()=>setAdding(false)}>Cancel</Btn>
            <Btn small onClick={handleAdd}>Add Location</Btn>
          </div>
        </Card>
      )}

      {group.locations.map(l=>{
        const contact=l.teeTimeContact||{};
        const hasContact=!!(contact.email||contact.name);
        const isEditing=editingId===l.id;
        return (
          <div key={l.id} style={{background:S.surface,borderRadius:12,marginBottom:10,overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px"}}>
              <div style={{fontSize:20}}>📍</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600,color:S.text}}>{l.name}</div>
                <div style={{fontSize:12,color:S.textMuted}}>{l.address||"No address saved"}</div>
              </div>
              <div style={{display:"flex",gap:6}}>
                {superAdmin&&<Btn variant="ghost" small onClick={()=>setEditingId(isEditing?null:l.id)}>{isEditing?"Cancel":"Edit contact"}</Btn>}
                {superAdmin&&group.locations.length>1&&<Btn variant="danger" small onClick={()=>onUpdate({...group,locations:group.locations.filter(x=>x.id!==l.id)})}>Remove</Btn>}
              </div>
            </div>
            {!isEditing&&(
              <div style={{borderTop:`1px solid ${S.cardBorder}44`,padding:"10px 16px",display:"flex",alignItems:"center",gap:12}}>
                <div style={{fontSize:12,fontWeight:600,color:S.textMuted,textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap"}}>Tee Time Contact</div>
                {hasContact?(
                  <div style={{flex:1,display:"flex",gap:16,flexWrap:"wrap"}}>
                    {contact.name&&<span style={{fontSize:12,color:S.text}}>{contact.name}</span>}
                    {contact.email&&<span style={{fontSize:12,color:S.accent}}>{contact.email}</span>}
                    {contact.phone&&<span style={{fontSize:12,color:S.textMuted}}>{contact.phone}</span>}
                  </div>
                ):(
                  <span style={{fontSize:12,color:S.textDim,fontStyle:"italic"}}>None saved — add one to enable tee time requests</span>
                )}
              </div>
            )}
            {isEditing&&(
              <ContactForm location={l} onSave={c=>{onUpdate({...group,locations:group.locations.map(x=>x.id===l.id?{...x,teeTimeContact:c}:x)});setEditingId(null);}} onCancel={()=>setEditingId(null)}/>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── GAME FORM ─────────────────────────────────────────────────────────────────
const GameForm=({game,group,adminUser,onSave,onCancel,onSendRequest})=>{
  const isNew=!game;
  const recurrenceDefault={frequency:"weekly",interval:1,weeklyDays:["Saturday"],monthlyOption:"dayOfMonth",monthlyDay:1,monthlyWeek:"first",monthlyWeekday:"Saturday",yearlyMonth:"January",yearlyDay:1,endType:"never",endAfter:10,endDate:""};
  const defaultForm={day:"Saturday",date:"",time:"8:00 AM",locationId:group.locations[0]?.id||"",description:"",rules:"",pairingMethod:"balanced",assignFoursomes:true,maxPlayers:16,recurring:false,recurrence:recurrenceDefault};
  const [form,setForm]=useState(isNew?defaultForm:{...game,recurrence:game.recurrence||recurrenceDefault,recurring:game.recurring||false});
  const [saved,setSaved]=useState(false);
  const [showModal,setShowModal]=useState(false);
  useEffect(()=>{
    if(game){setForm({...game,recurrence:game.recurrence||recurrenceDefault,recurring:game.recurring||false});}
  },[game?.id]);

  const sf=(k,v)=>setForm(f=>({...f,[k]:v}));
  const sr=(k,v)=>setForm(f=>({...f,recurrence:{...f.recurrence,[k]:v}}));
  const toggleWeeklyDay=day=>{
    const days=form.recurrence.weeklyDays.includes(day)?form.recurrence.weeklyDays.filter(d=>d!==day):[...form.recurrence.weeklyDays,day];
    sr("weeklyDays",days);
  };
  const selLoc=getLoc(group,form.locationId);
  const contact=selLoc?.teeTimeContact||{};
  const hasContact=!!(contact.email||contact.name);
  const lastReq=game?.teeTimeRequests?.slice(-1)[0];

  const handleSave=()=>{
    const out=isNew?{...form,id:uid(),groupId:group.id,registrations:[],waitlist:[],teeTimeRequests:[]}:{...game,...form};
    onSave(out);setSaved(true);setTimeout(()=>setSaved(false),2000);
  };

  return (
    <>
      {showModal&&adminUser&&(
        <TeeTimeModal game={game||{...form,id:"preview",maxPlayers:form.maxPlayers}} location={selLoc} adminUser={adminUser} group={group}
          onSend={req=>{onSendRequest&&onSendRequest(game?.id,req);setShowModal(false);}}
          onClose={()=>setShowModal(false)}/>
      )}
      <Card style={{marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <h2 style={{margin:0,fontSize:17,fontWeight:700,color:S.text}}>{isNew?"New Game":game.day+" — Edit"}</h2>
          <div style={{display:"flex",gap:8}}>
            {onCancel&&<Btn variant="ghost" small onClick={onCancel}>Cancel</Btn>}
            <Btn variant={saved?"ghost":"primary"} small onClick={handleSave}>{saved?"✓ Saved":"Save Game"}</Btn>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          <Sel label="Day" value={form.day} onChange={v=>sf("day",v)} options={["Saturday","Sunday","Monday","Tuesday","Wednesday","Thursday","Friday"].map(d=>({value:d,label:d}))}/>
          <Inp label="Date" value={form.date} onChange={v=>sf("date",v)} placeholder="June 7, 2025" required/>
          <Inp label="1st Tee Time" value={form.time} onChange={v=>sf("time",v)} placeholder="8:00 AM" required/>
        </div>
        <Sel label="Location" value={form.locationId} onChange={v=>sf("locationId",v)} options={group.locations.map(l=>({value:l.id,label:l.name}))}/>

        <div style={{background:hasContact?S.accentSubtle:S.warningBg,border:`1px solid ${hasContact?S.accent+"44":S.warning+"33"}`,borderRadius:10,padding:"12px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:160}}>
            <div style={{fontSize:11,fontWeight:700,color:hasContact?S.accent:S.warning,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:3}}>Tee Time Contact</div>
            {hasContact?(
              <div style={{fontSize:13,color:S.text}}>
                {contact.name&&<span style={{marginRight:10}}>{contact.name}</span>}
                {contact.email&&<span style={{color:S.textMuted,marginRight:10}}>{contact.email}</span>}
                {contact.phone&&<span style={{color:S.textMuted}}>{contact.phone}</span>}
              </div>
            ):(
              <div style={{fontSize:12,color:S.warning}}>No contact saved for {selLoc?.name||"this location"} — add one in the Locations tab.</div>
            )}
            {lastReq&&(
              <div style={{fontSize:11,color:S.textDim,marginTop:3}}>
                Last request: {lastReq.sentAt} · <span style={{color:lastReq.status==="responded"?S.accent:S.warning}}>{lastReq.status==="responded"?"Response received":"Awaiting reply"}</span>
              </div>
            )}
          </div>
          {!isNew&&hasContact&&<Btn variant="info" small onClick={()=>setShowModal(true)}>📧 Request Tee Times</Btn>}
          {!isNew&&!hasContact&&<span style={{fontSize:11,color:S.textDim}}>Save a contact to enable requests</span>}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}>
          <div/>
          <Inp label="Max Players" type="number" value={form.maxPlayers} onChange={v=>sf("maxPlayers",parseInt(v)||0)}/>
        </div>
        <Tog label="Recurring game" value={form.recurring} onChange={v=>sf("recurring",v)} hint="Auto-creates next week's game after this one closes"/>
        {form.recurring&&(
          <Card style={{marginBottom:14,background:S.surface,border:`1px solid ${S.cardBorder}`}}>
            <SecTitle>Recurrence</SecTitle>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Sel label="Repeat" value={form.recurrence.frequency} onChange={v=>sr("frequency",v)} options={RECURRENCE_OPTIONS}/>
              <Inp label="Every" type="number" value={form.recurrence.interval} onChange={v=>sr("interval",Math.max(1,parseInt(v)||1))} placeholder="1" hint="Repeat every N periods"/>
            </div>
            {form.recurrence.frequency==="weekly"&&(
              <div style={{marginBottom:14}}>
                <div style={{fontSize:12,fontWeight:600,color:S.textMuted,marginBottom:8}}>Repeat on</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                  {WEEKDAYS.map(day=>{
                    const active=form.recurrence.weeklyDays.includes(day);
                    return (
                      <button key={day} type="button" onClick={()=>toggleWeeklyDay(day)} style={{padding:"8px 10px",borderRadius:8,border:`1px solid ${active?S.accent:S.cardBorder}`,background:active?S.accentSubtle:"transparent",color:active?S.accent:S.text,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>{day.slice(0,3)}</button>
                    );
                  })}
                </div>
              </div>
            )}
            {form.recurrence.frequency==="monthly"&&(
              <div style={{marginBottom:14}}>
                <Sel label="Monthly repeat" value={form.recurrence.monthlyOption} onChange={v=>sr("monthlyOption",v)} options={[{value:"dayOfMonth",label:"Day of month"},{value:"weekday",label:"Weekday pattern"}]}/>
                {form.recurrence.monthlyOption==="dayOfMonth"?
                  <Inp label="Day" type="number" value={form.recurrence.monthlyDay} onChange={v=>sr("monthlyDay",Math.max(1,Math.min(31,parseInt(v)||1)))} placeholder="1"/>
                  :
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <Sel label="Week" value={form.recurrence.monthlyWeek} onChange={v=>sr("monthlyWeek",v)} options={[{value:"first",label:"First"},{value:"second",label:"Second"},{value:"third",label:"Third"},{value:"fourth",label:"Fourth"},{value:"last",label:"Last"}]}/>
                    <Sel label="Day" value={form.recurrence.monthlyWeekday} onChange={v=>sr("monthlyWeekday",v)} options={WEEKDAYS.map(d=>({value:d,label:d}))}/>
                  </div>
                }
              </div>
            )}
            {form.recurrence.frequency==="yearly"&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                <Sel label="Month" value={form.recurrence.yearlyMonth} onChange={v=>sr("yearlyMonth",v)} options={MONTHS.map(m=>({value:m,label:m}))}/>
                <Inp label="Day" type="number" value={form.recurrence.yearlyDay} onChange={v=>sr("yearlyDay",Math.max(1,Math.min(31,parseInt(v)||1)))} placeholder="1"/>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Sel label="Ends" value={form.recurrence.endType} onChange={v=>sr("endType",v)} options={[{value:"never",label:"Never"},{value:"after",label:"After occurrences"},{value:"on",label:"On date"}]}/>
              {form.recurrence.endType==="after"?
                <Inp label="Occurrences" type="number" value={form.recurrence.endAfter} onChange={v=>sr("endAfter",Math.max(1,parseInt(v)||1))}/>
                : form.recurrence.endType==="on"?
                  <Inp label="End date" value={form.recurrence.endDate} onChange={v=>sr("endDate",v)} placeholder="December 31, 2025"/>
                  : <div/>
              }
            </div>
          </Card>
        )}
        <Tog label="Assign players" value={form.assignFoursomes} onChange={v=>sf("assignFoursomes",v)} hint="System auto-assigns players by pairing method"/>
        {form.assignFoursomes&&<Sel label="Pairing method" value={form.pairingMethod} onChange={v=>sf("pairingMethod",v)} options={PAIRING_OPTIONS}/>}
        <TA label="Description" value={form.description} onChange={v=>sf("description",v)}/>
        <TA label="Rules" value={form.rules} onChange={v=>sf("rules",v)}/>
      </Card>
    </>
  );
};

// ── MEMBERS TAB ───────────────────────────────────────────────────────────────
const MembersTab=({group,users,currentUserId,onUpdate,superAdmin})=>{
  const [inviteEmail,setInviteEmail]=useState("");
  return (
    <div>
      {superAdmin&&(
        <Card style={{marginBottom:16}}>
          <SecTitle>Invite a player</SecTitle>
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:1}}><Inp label="" value={inviteEmail} onChange={setInviteEmail} placeholder="player@example.com" type="email"/></div>
            <Btn small onClick={()=>setInviteEmail("")}>Send Invite</Btn>
          </div>
          <p style={{margin:0,fontSize:11,color:S.textDim}}>They'll receive a link to create an account and join your group as a player.</p>
        </Card>
      )}
      {group.memberships.map(m=>{
        const u=getUser(users,m.userId);
        if(!u)return null;
        const isSelf=m.userId===currentUserId;
        return (
          <div key={m.userId} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:S.surface,borderRadius:10,marginBottom:8}}>
            <Avatar user={u} size={36}/>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:500,color:S.text}}>{fullName(u)}{isSelf&&<span style={{fontSize:11,color:S.textDim,marginLeft:6}}>(you)</span>}</div>
              <div style={{fontSize:12,color:S.textMuted}}>{u.email} · HCP {u.handicap}</div>
            </div>
            {superAdmin&&!isSelf?(
              <select value={m.role} onChange={e=>onUpdate({...group,memberships:group.memberships.map(x=>x.userId===m.userId?{...x,role:e.target.value}:x)})} style={{background:S.card,border:`1px solid ${S.cardBorder}`,borderRadius:6,padding:"4px 8px",color:S.text,fontSize:12,fontFamily:"inherit",cursor:"pointer"}}>
                <option value="superadmin">Owner</option>
                <option value="admin">Admin</option>
                <option value="player">Player</option>
              </select>
            ):<RoleBadge role={m.role}/>}
            {superAdmin&&!isSelf&&<Btn variant="danger" small onClick={()=>onUpdate({...group,memberships:group.memberships.filter(x=>x.userId!==m.userId)})}>Remove</Btn>}
          </div>
        );
      })}
    </div>
  );
};

// ── ADMIN PAGE ────────────────────────────────────────────────────────────────
const AdminPage=({group,user,users,games,onUpdateGroup,onSaveGame,onDeleteGame,onSendRequest,onSimulateResponse,onSendGameInvite})=>{
  const [tab,setTab]=useState("games");
  const [showNew,setShowNew]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const currentRole=getMem(group,user.id)?.role;
  const superAdmin=currentRole==="superadmin";
  const myGames=groupGames(games,group.id);
  const tabs=[{id:"games",label:"Games"},{id:"locations",label:"Locations"},...(superAdmin?[{id:"members",label:"Members & Roles"},{id:"settings",label:"Group Settings"}]:[])];

  return (
    <div style={{maxWidth:780,margin:"0 auto",padding:"24px 16px"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <h1 style={{margin:0,fontSize:22,fontWeight:800,color:S.text,letterSpacing:"-0.02em"}}>Admin Panel</h1>
            <RoleBadge role={currentRole||"player"}/>
          </div>
          <p style={{margin:0,fontSize:13,color:S.textMuted}}>{group.name}</p>
        </div>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:22,overflowX:"auto"}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{background:tab===t.id?S.accentSubtle:S.surface,border:`1px solid ${tab===t.id?S.accent:S.cardBorder}`,borderRadius:8,padding:"7px 16px",color:tab===t.id?S.accent:S.textMuted,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{t.label}</button>
        ))}
      </div>

      {tab==="games"&&(
        <>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
            <Btn variant="gold" small onClick={()=>{setShowNew(true);setEditingId(null);}}>+ New Game</Btn>
          </div>
          {showNew&&<GameForm group={group} adminUser={user} onSave={g=>{onSaveGame(g);setShowNew(false);}} onCancel={()=>setShowNew(false)} onSendRequest={onSendRequest}/>}
          {myGames.length===0&&!showNew&&<Card><p style={{color:S.textMuted,textAlign:"center",margin:0}}>No games yet. Create your first game above.</p></Card>}
          {myGames.map(g=>{
            const location=getLoc(group,g.locationId);
            return (
            <div key={g.id}>
              {editingId===g.id?(
                <GameForm key={`edit-${g.id}`} game={g} group={group} adminUser={user} onSave={u=>{onSaveGame(u);setEditingId(null);}} onCancel={()=>setEditingId(null)} onSendRequest={onSendRequest}/>
              ):(
                <Card style={{marginBottom:16}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                    <div>
                      <div style={{fontSize:16,fontWeight:700,color:S.text}}>{g.day} · {g.date} · {g.time}</div>
                      <div style={{fontSize:12,color:S.textMuted,marginTop:3}}>
                        {location?.name} · {g.registrations.length}/{g.maxPlayers} players
                        {g.recurring&&<span style={{marginLeft:8,color:S.accent}}>↻ Recurring</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <Btn variant="ghost" small onClick={()=>setEditingId(g.id)}>Edit</Btn>
                      <Btn variant="danger" small onClick={()=>onDeleteGame(g.id)}>Delete</Btn>
                    </div>
                  </div>
                  <GameInvitePanel game={g} group={group} users={users} onSendInvite={onSendGameInvite}/>
                  {g.registrations.length>0&&(
                    <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${S.cardBorder}33`}}>
                      <div style={{fontSize:11,color:S.textMuted,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Roster</div>
                      {g.registrations.map(uid2=>{
                        const u2=getUser(users,uid2);
                        return u2?(<div key={uid2} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0"}}><Avatar user={u2} size={26}/><span style={{fontSize:13,color:S.text}}>{fullName(u2)}</span><span style={{fontSize:12,color:S.textMuted}}>HCP {u2.handicap}</span></div>):null;
                      })}
                    </div>
                  )}
                  <TeeTimePanel game={g} location={location} onSimulateResponse={onSimulateResponse}/>
                </Card>
              )}
            </div>
          )})}
        </>
      )}

      {tab==="locations"&&<Card><LocationsTab group={group} onUpdate={onUpdateGroup} superAdmin={superAdmin}/></Card>}
      {tab==="members"&&superAdmin&&<MembersTab group={group} users={users} currentUserId={user.id} onUpdate={onUpdateGroup} superAdmin={superAdmin}/>}
      {tab==="settings"&&superAdmin&&(
        <Card>
          <SecTitle>Group Settings</SecTitle>
          <GroupSettings group={group} onUpdate={onUpdateGroup}/>
        </Card>
      )}
    </div>
  );
};

const GroupSettings=({group,onUpdate})=>{
  const [name,setName]=useState(group.name);
  const [desc,setDesc]=useState(group.description);
  const [saved,setSaved]=useState(false);
  return (
    <>
      <Inp label="Group name" value={name} onChange={setName} required/>
      <Inp label="Description" value={desc} onChange={setDesc} placeholder="What's this group about?"/>
      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <Btn onClick={()=>{onUpdate({...group,name,description:desc});setSaved(true);setTimeout(()=>setSaved(false),2000);}} variant={saved?"ghost":"primary"}>{saved?"✓ Saved":"Save Settings"}</Btn>
      </div>
    </>
  );
};

// ── PROFILE PAGE ──────────────────────────────────────────────────────────────
const GameInvitePanel=({game,group,users,onSendInvite})=>{
  const memberUsers=group.memberships
    .map(m=>getUser(users,m.userId))
    .filter(u=>u?.email);
  const [selectedUserId,setSelectedUserId]=useState(memberUsers[0]?.id||"");
  const [sending,setSending]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  useEffect(()=>{
    if(!selectedUserId&&memberUsers[0]?.id)setSelectedUserId(memberUsers[0].id);
  },[memberUsers.length,selectedUserId]);

  const selectedUser=getUser(memberUsers,selectedUserId);
  const alreadyIn=game.registrations.includes(selectedUserId)||game.waitlist.includes(selectedUserId);

  const send=async()=>{
    if(!selectedUser)return;
    setSending(true);setMessage("");setError("");
    try{
      await onSendInvite(game,selectedUser);
      setMessage(`Invite sent to ${selectedUser.email}`);
    }catch(err){
      setError(err.message);
    }finally{
      setSending(false);
    }
  };

  if(memberUsers.length===0)return null;

  return (
    <div style={{marginTop:12,padding:"12px 0",borderTop:`1px solid ${S.cardBorder}33`,borderBottom:`1px solid ${S.cardBorder}33`}}>
      <div style={{fontSize:11,color:S.textMuted,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Email Invite</div>
      <div style={{display:"flex",gap:8,alignItems:"flex-start",flexWrap:"wrap"}}>
        <select value={selectedUserId} onChange={e=>{setSelectedUserId(e.target.value);setMessage("");setError("");}} style={{flex:"1 1 220px",background:S.surface,border:`1px solid ${S.cardBorder}`,borderRadius:8,padding:"8px 10px",color:S.text,fontSize:13,fontFamily:"inherit"}}>
          {memberUsers.map(u=>(
            <option key={u.id} value={u.id}>{fullName(u)} - {u.email}</option>
          ))}
        </select>
        <Btn small onClick={send} disabled={sending||!selectedUser}>
          {sending?"Sending...":"Send Invite"}
        </Btn>
      </div>
      {alreadyIn&&<div style={{fontSize:11,color:S.warning,marginTop:6}}>This player is already registered or waitlisted. A new response link will still work.</div>}
      {message&&<div style={{fontSize:12,color:S.accent,marginTop:6}}>{message}</div>}
      {error&&<div style={{fontSize:12,color:S.danger,marginTop:6}}>{error}</div>}
    </div>
  );
};

const ProfilePage=({user,groups,games,onUpdateUser})=>{
  const [p,setP]=useState({...user,handicap:String(user.handicap)});
  const [saved,setSaved]=useState(false);
  const [errors,setErrors]=useState({});
  const sp=k=>v=>{setP(pr=>({...pr,[k]:v}));setErrors(e=>({...e,[k]:null}));};
  const validate=()=>{const e={};if(!p.firstName.trim())e.firstName="Required";if(!p.lastName.trim())e.lastName="Required";if(!p.email.includes("@"))e.email="Valid email required";if(!p.phone.trim())e.phone="Required";if(!p.handicap||isNaN(+p.handicap))e.handicap="Must be a number";return e;};
  const myGroups=groups.filter(g=>g.memberships.some(m=>m.userId===user.id));
  const myGames=games.filter(g=>g.registrations.includes(user.id));
  return (
    <div style={{maxWidth:560,margin:"0 auto",padding:"24px 16px"}}>
      <h1 style={{margin:"0 0 4px",fontSize:22,fontWeight:800,color:S.text,letterSpacing:"-0.02em"}}>My Profile</h1>
      <p style={{margin:"0 0 24px",fontSize:13,color:S.textMuted}}>Visible to other players in your groups</p>
      <Card style={{marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{width:64,height:64,borderRadius:14,background:S.accentSubtle,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:S.accent,flexShrink:0}}>
            {(p.firstName[0]||"?").toUpperCase()}{(p.lastName[0]||"?").toUpperCase()}
          </div>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:S.text}}>{p.firstName||"First"} {p.lastName||"Last"}</div>
            <div style={{fontSize:13,color:S.textMuted,marginTop:2}}>HCP <strong style={{color:S.accent}}>{p.handicap||"—"}</strong>{p.ghin&&<span style={{marginLeft:12}}>GHIN {p.ghin}</span>}</div>
            <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
              {myGroups.map(g=>{const m=getMem(g,user.id);return(<span key={g.id} style={{fontSize:11,color:S.textDim,display:"flex",alignItems:"center",gap:4}}>{g.name} <RoleBadge role={m?.role||"player"}/></span>);})}
            </div>
          </div>
        </div>
      </Card>
      <Card>
        <SecTitle>Personal Information</SecTitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="First name" value={p.firstName} onChange={sp("firstName")} required placeholder="James" error={errors.firstName}/>
          <Inp label="Last name" value={p.lastName} onChange={sp("lastName")} required placeholder="Harrington" error={errors.lastName}/>
        </div>
        <Inp label="Phone" type="tel" value={p.phone} onChange={sp("phone")} required placeholder="770-555-0000" error={errors.phone}/>
        <Inp label="Email" type="email" value={p.email} onChange={sp("email")} required placeholder="you@example.com" error={errors.email}/>
        <Divider/>
        <SecTitle>Golf Info</SecTitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="Handicap Index" type="number" value={p.handicap} onChange={sp("handicap")} required placeholder="15.4" hint="Your current official handicap" error={errors.handicap}/>
          <Inp label="GHIN (optional)" value={p.ghin||""} onChange={sp("ghin")} placeholder="7-digit number" hint="Enables system pairing"/>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
          <Btn onClick={()=>{const e=validate();if(Object.keys(e).length){setErrors(e);return;}onUpdateUser({...p,handicap:+p.handicap});setSaved(true);setTimeout(()=>setSaved(false),2500);}} variant={saved?"ghost":"primary"}>{saved?"✓ Saved":"Save Profile"}</Btn>
        </div>
      </Card>
      <Card style={{marginTop:20}}>
        <SecTitle>My Groups</SecTitle>
        {myGroups.length===0?<p style={{color:S.textMuted,fontSize:13,margin:0}}>You haven't joined any groups yet.</p>:myGroups.map(g=>{
          const m=getMem(g,user.id);
          return(<div key={g.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${S.cardBorder}33`}}><div><div style={{fontSize:14,fontWeight:600,color:S.text}}>{g.name}</div><div style={{fontSize:12,color:S.textMuted}}>{g.memberships.length} members · {g.locations.length} location{g.locations.length!==1?"s":""}</div></div><RoleBadge role={m?.role||"player"}/></div>);
        })}
      </Card>
      {myGames.length>0&&(
        <Card style={{marginTop:20}}>
          <SecTitle>Upcoming Games</SecTitle>
          {myGames.map(g=>{
            const grp=groups.find(gr=>gr.id===g.groupId);
            return(<div key={g.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${S.cardBorder}33`}}><div><div style={{fontSize:14,fontWeight:600,color:S.text}}>{g.day} · {g.date}</div><div style={{fontSize:12,color:S.textMuted}}>{g.time} · {grp?.name}</div></div><Badge>Registered</Badge></div>);
          })}
        </Card>
      )}
    </div>
  );
};

// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App(){
  const responseMatch=window.location.pathname.match(/^\/respond\/([^/]+)\/?$/);
  const [db,setDb]=useState({users:[],groups:[],games:[]});
  const [userId,setUserId]=useState(null);
  const [page,setPage]=useState("splash");
  const [groupId,setGroupId]=useState(null);
  const [appLoading,setAppLoading]=useState(true);

  const loadData=async(authUserId)=>{
    try{
      // User profile
      const{data:userRow}=await supabase.from("users").select("*").eq("id",authUserId).single();

      // Group IDs this user belongs to
      const{data:memRows}=await supabase.from("group_memberships").select("group_id").eq("user_id",authUserId);
      const groupIds=(memRows||[]).map(m=>m.group_id);

      let users=userRow?[toUiUser(userRow)]:[];
      let groups=[];
      let games=[];

      if(groupIds.length>0){
        // Groups
        const{data:groupRows}=await supabase.from("groups").select("id,name,description").in("id",groupIds);
        // Memberships for these groups
        const{data:allMems}=await supabase.from("group_memberships").select("group_id,user_id,role").in("group_id",groupIds);
        // Locations for these groups
        const{data:locRows}=await supabase.from("locations").select("location_id,group_id,name,address,tee_time_contact,is_active").in("group_id",groupIds).neq("is_active",false);

        // All member user IDs (across all groups)
        const allMemberIds=[...new Set((allMems||[]).map(m=>m.user_id))];
        if(allMemberIds.length>0){
          const{data:userRows}=await supabase.from("users").select("id,first_name,last_name,email,phone,handicap,ghin").in("id",allMemberIds);
          users=(userRows||[]).map(toUiUser);
        }

        // Assemble groups
        groups=(groupRows||[]).map(row=>({
          id:row.id,
          name:row.name||"",
          description:row.description||"",
          locations:(locRows||[]).filter(l=>l.group_id===row.id).map(toUiLocation),
          memberships:(allMems||[]).filter(m=>m.group_id===row.id).map(m=>({userId:m.user_id,role:m.role||"player"})),
        }));

        // Games
        const{data:gameRows}=await supabase.from("games")
          .select("id,group_id,location_id,description,rules,max_players,pairing_method,assign_players,recurring,recurrence,day_of_week,first_tee_time,scheduled_date")
          .in("group_id",groupIds).neq("is_active",false);

        const gameIds=(gameRows||[]).map(g=>g.id);
        let regRows=[];
        let ttrRows=[];
        if(gameIds.length>0){
          const{data:r}=await supabase.from("game_registrations").select("game_id,user_id,status,position").in("game_id",gameIds);
          const{data:t}=await supabase.from("tee_time_requests").select("response_token_hash,game_id,requested_time,to_pro_shop_name,to_pro_shop_email,status,response,sent_at").in("game_id",gameIds);
          regRows=r||[];
          ttrRows=t||[];
        }
        games=(gameRows||[]).map(row=>toUiGame(row,regRows,ttrRows));
      }

      setDb({users,groups,games});
    }catch(err){
      console.error("Data load error:",err);
    }
  };

  useEffect(()=>{
    if(!supabase){
      setAppLoading(false);
      return;
    }
    const{data:{subscription}}=supabase.auth.onAuthStateChange(async(event,session)=>{
      if(session?.user){
        setUserId(session.user.id);
        await loadData(session.user.id);
      }else{
        setUserId(null);
        setDb({users:[],groups:[],games:[]});
      }
      setAppLoading(false);
    });
    return()=>subscription.unsubscribe();
  },[]);

  const user=db.users.find(u=>u.id===userId);
  const myGroups=db.groups.filter(g=>g.memberships.some(m=>m.userId===userId));
  const group=db.groups.find(g=>g.id===groupId);

  useEffect(()=>{if(userId&&!groupId&&myGroups.length>0)setGroupId(myGroups[0].id);},[userId,myGroups.length,groupId]);

  if(responseMatch)return <PublicTeeTimeResponsePage token={decodeURIComponent(responseMatch[1])}/>;

  if(!supabase)return <SetupErrorPage/>;

  if(appLoading)return(
    <div style={{minHeight:"100vh",background:S.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:48,height:48,borderRadius:12,background:S.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 16px"}}>⛳</div>
        <div style={{fontSize:14,color:S.textMuted}}>Loading…</div>
      </div>
    </div>
  );

  if(!userId)return <AuthPage/>;

  // ── mutations ──────────────────────────────────────────────────────────────

  const handleRegister=async(gameId)=>{
    const game=db.games.find(g=>g.id===gameId);
    if(!game)return;
    const isReg=game.registrations.includes(userId);
    const isWait=game.waitlist.includes(userId);
    const isFull=game.registrations.length>=game.maxPlayers;

    // optimistic UI update
    setDb(d=>({...d,games:d.games.map(g=>{
      if(g.id!==gameId)return g;
      if(isReg)return{...g,registrations:g.registrations.filter(id=>id!==userId)};
      if(isWait)return{...g,waitlist:g.waitlist.filter(id=>id!==userId)};
      if(isFull)return{...g,waitlist:[...g.waitlist,userId]};
      return{...g,registrations:[...g.registrations,userId]};
    })}));

    // persist
    if(isReg||isWait){
      await supabase.from("game_registrations").delete().eq("game_id",gameId).eq("user_id",userId);
    }else{
      const status=isFull?"waitlisted":"registered";
      const position=isFull?game.waitlist.length+1:null;
      await supabase.from("game_registrations").upsert({game_id:gameId,user_id:userId,status,position});
    }
  };

  const handleSaveGame=async(game)=>{
    setDb(d=>({...d,games:d.games.some(g=>g.id===game.id)?d.games.map(g=>g.id===game.id?game:g):[...d.games,game]}));
    const{error}=await supabase.from("games").upsert(toDbGame(game));
    if(error)console.error("Save game:",error);
  };

  const handleDeleteGame=async(gameId)=>{
    setDb(d=>({...d,games:d.games.filter(g=>g.id!==gameId)}));
    await supabase.from("games").update({is_active:false}).eq("id",gameId);
  };

  const handleUpdateGroup=async(updated)=>{
    const current=db.groups.find(g=>g.id===updated.id);
    setDb(d=>({...d,groups:d.groups.map(g=>g.id===updated.id?updated:g)}));

    await supabase.from("groups").update({name:updated.name,description:updated.description}).eq("id",updated.id);

    if(current){
      // Sync locations
      const currentLocIds=new Set(current.locations.map(l=>l.id));
      const updatedLocIds=new Set(updated.locations.map(l=>l.id));
      for(const l of current.locations){
        if(!updatedLocIds.has(l.id))await supabase.from("locations").update({is_active:false}).eq("location_id",l.id);
      }
      for(const l of updated.locations){
        await supabase.from("locations").upsert(toDbLocation(l,updated.id));
      }

      // Sync memberships
      const currentMemMap=new Map(current.memberships.map(m=>[m.userId,m.role]));
      const updatedMemMap=new Map(updated.memberships.map(m=>[m.userId,m.role]));
      for(const[uid2,role]of updatedMemMap){
        if(currentMemMap.get(uid2)!==role)await supabase.from("group_memberships").upsert({group_id:updated.id,user_id:uid2,role});
      }
      for(const[uid2]of currentMemMap){
        if(!updatedMemMap.has(uid2))await supabase.from("group_memberships").delete().eq("group_id",updated.id).eq("user_id",uid2);
      }
    }
  };

  const handleUpdateUser=async(updated)=>{
    setDb(d=>({...d,users:d.users.map(u=>u.id===updated.id?updated:u)}));
    await supabase.from("users").update({
      first_name:updated.firstName,last_name:updated.lastName,
      email:updated.email,phone:updated.phone,
      handicap:updated.handicap,ghin:updated.ghin||null,
    }).eq("id",updated.id);
  };

  const handleSendRequest=(gameId,request)=>{
    setDb(d=>({...d,games:d.games.map(g=>g.id===gameId?{...g,teeTimeRequests:[...(g.teeTimeRequests||[]),request]}:g)}));
  };

  const handleSendGameInvite=async(game,recipient)=>{
    const{data:{session}}=await supabase.auth.getSession();
    if(!session?.access_token)throw new Error("Sign in again to send email invites.");

    const location=getLoc(group,game.locationId);
    const subject=`Can you play ${game.day}?`;
    const body=[
      `Hi ${recipient.firstName},`,
      "",
      `Can you play with ${group.name} on ${game.day}, ${game.date} at ${game.time}?`,
      location?.name?`Course: ${location.name}`:null,
      game.description?`Details: ${game.description}`:null,
      "",
      "Use one of the response links below to let the group know.",
    ].filter(Boolean).join("\n");

    const res=await fetch("/api/email/send",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        Authorization:`Bearer ${session.access_token}`,
      },
      body:JSON.stringify({
        groupId:group.id,
        gameId:game.id,
        recipientUserId:recipient.id,
        toEmail:recipient.email,
        eventType:"game_invite",
        subject,
        body,
        actions:["yes","no","waitlist"],
      }),
    });
    const payload=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(payload.error||payload.details||"Unable to send invite");
    return payload;
  };

  const handleSimulateResponse=(gameId,requestId)=>setDb(d=>({...d,games:d.games.map(g=>{
    if(g.id!==gameId)return g;
    return{...g,teeTimeRequests:(g.teeTimeRequests||[]).map(r=>{
      if(r.id!==requestId)return r;
      const confirmed=Math.random()>0.35;
      return{...r,status:"responded",response:{
        type:confirmed?"confirmed":"alternates",
        confirmedTime:confirmed?r.requestedTimes?.[0]:null,
        alternateTimes:confirmed?null:["9:00 AM","9:10 AM","9:20 AM","9:30 AM"],
        note:"Confirmed for your group. Please check in at the pro shop 30 minutes prior. Cart fees are $20/person.",
        respondedAt:new Date().toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}),
      }};
    })};
  })}));

  return(
    <div style={{minHeight:"100vh",background:S.bg,color:S.text,fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;}
        input[type=number]::-webkit-inner-spin-button{opacity:0.3;}
        ::-webkit-scrollbar{width:6px;}::-webkit-scrollbar-thumb{background:#2a3f2c;border-radius:3px;}
        textarea{resize:vertical;}select option{background:#132016;}
      `}</style>
      {group&&user&&<TopNav page={page} setPage={setPage} user={user} group={group} groups={myGroups} onGroupChange={id=>{setGroupId(id);setPage("splash");}} onSignOut={async()=>{await supabase.auth.signOut();setUserId(null);setGroupId(null);setPage("splash");}}/>}
      {!group&&user&&myGroups.length===0&&(
        <div style={{maxWidth:480,margin:"80px auto",padding:"0 16px",textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:16}}>⛳</div>
          <div style={{fontSize:20,fontWeight:700,color:S.text,marginBottom:8}}>No groups yet</div>
          <div style={{fontSize:14,color:S.textMuted,lineHeight:1.7,marginBottom:24}}>Sign out and register to create or join a group, or ask a group owner to add you.</div>
          <Btn variant="danger" onClick={async()=>{await supabase.auth.signOut();setUserId(null);}}>Sign out</Btn>
        </div>
      )}
      {page==="splash"&&group&&user&&<SplashPage group={group} user={user} users={db.users} games={db.games} onRegister={handleRegister}/>}
      {page==="admin"&&group&&user&&canEdit(group,userId)&&<AdminPage group={group} user={user} users={db.users} games={db.games} onUpdateGroup={handleUpdateGroup} onSaveGame={handleSaveGame} onDeleteGame={handleDeleteGame} onSendRequest={handleSendRequest} onSimulateResponse={handleSimulateResponse} onSendGameInvite={handleSendGameInvite}/>}
      {page==="profile"&&user&&<ProfilePage user={user} groups={db.groups} games={db.games} onUpdateUser={handleUpdateUser}/>}
    </div>
  );
}
