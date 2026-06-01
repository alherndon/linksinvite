import { useState, useEffect } from "react";

const S = {
  bg:"#0d1a0e",surface:"#132016",card:"#1a2b1c",cardBorder:"#2a3f2c",
  accent:"#4ade80",accentDim:"#22c55e",accentSubtle:"#1a3321",
  gold:"#f5c842",text:"#e8f0e9",textMuted:"#7a9e7e",textDim:"#4a6b4e",
  danger:"#f87171",dangerBg:"#2d1515",warning:"#fb923c",warningBg:"#2d1a0a",
  info:"#60a5fa",infoBg:"#0d1f35",
};

const SEED = {
  users:[
    {id:"u1",firstName:"James",lastName:"Harrington",email:"james@example.com",phone:"770-555-0101",handicap:15,ghin:""},
    {id:"u2",firstName:"Tom",  lastName:"Hargrove",  email:"tom@example.com",  phone:"770-555-0102",handicap:8, ghin:"1234567"},
    {id:"u3",firstName:"Mike", lastName:"Delaney",   email:"mike@example.com", phone:"770-555-0103",handicap:14,ghin:""},
    {id:"u4",firstName:"Ray",  lastName:"Bonner",    email:"ray@example.com",  phone:"770-555-0104",handicap:19,ghin:""},
    {id:"u5",firstName:"Phil", lastName:"Castro",    email:"phil@example.com", phone:"770-555-0105",handicap:12,ghin:""},
  ],
  groups:[
    {
      id:"g1",name:"Newnan Saturday Crew",description:"Weekly Saturday morning game at Newnan CC.",
      locations:[
        {id:"l1",name:"Newnan Country Club",address:"200 Newnan CC Dr, Newnan, GA",lat:33.38,lng:-84.77,
         teeTimeContact:{name:"Bobby Stafford",email:"pro@newnancc.com",phone:"770-253-4400"}},
        {id:"l2",name:"Canongate Golf Club",address:"1 Golf Course Dr, Palmetto, GA",lat:33.52,lng:-84.67,
         teeTimeContact:{name:"",email:"",phone:""}},
      ],
      memberships:[
        {userId:"u1",role:"superadmin"},{userId:"u2",role:"admin"},
        {userId:"u3",role:"player"},{userId:"u4",role:"player"},
      ],
    },
    {
      id:"g2",name:"Atlanta Corporate League",description:"Competitive corporate scramble every other Sunday.",
      locations:[
        {id:"l3",name:"East Lake Golf Club",address:"2575 Alston Dr SE, Atlanta, GA",lat:33.73,lng:-84.33,
         teeTimeContact:{name:"Dana Whitmore",email:"teetimes@eastlake.com",phone:"404-373-5600"}},
      ],
      memberships:[
        {userId:"u5",role:"superadmin"},{userId:"u1",role:"player"},
      ],
    },
  ],
  games:[
    {
      id:"gm1",groupId:"g1",locationId:"l1",day:"Saturday",date:"June 7, 2025",time:"8:00 AM",
      description:"Balanced foursome stroke play. Cart fees included. Range balls from 7:30 AM.",
      rules:"Full handicap. Lost ball: stroke & distance. Winter rules on fairways. Pace: 4.5 hrs max.",
      pairingMethod:"balanced",assignFoursomes:true,maxPlayers:16,recurring:true,
      registrations:["u2","u3","u4"],waitlist:[],
      teeTimeRequests:[
        {id:"ttr1",sentAt:"May 30, 2025 Â· 9:14 AM",requestedTimes:["8:00 AM","8:10 AM","8:20 AM"],
         players:16,toName:"Bobby Stafford",toEmail:"pro@newnancc.com",status:"responded",
         response:{type:"confirmed",confirmedTime:"8:00 AM",alternateTimes:null,
           note:"Confirmed for Saturday June 7. Please arrive by 7:30 AM for check-in.",
           respondedAt:"May 30, 2025 Â· 11:42 AM"}},
      ],
    },
    {
      id:"gm2",groupId:"g1",locationId:"l1",day:"Sunday",date:"June 8, 2025",time:"9:30 AM",
      description:"Relaxed 9-hole scramble. All skill levels welcome. Carts optional.",
      rules:"Scramble: best ball selected, all play from that spot. Max 10 strokes per hole.",
      pairingMethod:"blindDraw",assignFoursomes:false,maxPlayers:12,recurring:false,
      registrations:["u3"],waitlist:[],teeTimeRequests:[],
    },
    {
      id:"gm3",groupId:"g2",locationId:"l3",day:"Sunday",date:"June 8, 2025",time:"11:00 AM",
      description:"Corporate scramble. Teams of 4. Prizes for 1st, 2nd, closest to pin.",
      rules:"Best ball scramble. Handicap: 80% of low player in team. No mulligans.",
      pairingMethod:"system",assignFoursomes:true,maxPlayers:20,recurring:true,
      registrations:["u5","u1"],waitlist:[],
      teeTimeRequests:[
        {id:"ttr2",sentAt:"May 29, 2025 Â· 2:00 PM",requestedTimes:["11:00 AM","11:10 AM","11:20 AM","11:30 AM"],
         players:20,toName:"Dana Whitmore",toEmail:"teetimes@eastlake.com",status:"pending",response:null},
      ],
    },
  ],
};

const WEATHER={
  l1:[{day:"Fri",icon:"â˜€ï¸",hi:84,lo:67,rain:5,rating:"Excellent"},{day:"Sat",icon:"â›…",hi:79,lo:65,rain:22,rating:"Good"},{day:"Sun",icon:"ðŸŒ¦",hi:74,lo:63,rain:40,rating:"Fair"}],
  l2:[{day:"Fri",icon:"â›…",hi:82,lo:65,rain:10,rating:"Good"},{day:"Sat",icon:"â˜€ï¸",hi:85,lo:68,rain:3,rating:"Excellent"},{day:"Sun",icon:"ðŸŒ§",hi:71,lo:60,rain:70,rating:"Poor"}],
  l3:[{day:"Fri",icon:"â˜€ï¸",hi:86,lo:70,rain:2,rating:"Excellent"},{day:"Sat",icon:"â˜€ï¸",hi:88,lo:72,rain:5,rating:"Excellent"},{day:"Sun",icon:"â›…",hi:80,lo:66,rain:18,rating:"Good"}],
};

const PAIRING_OPTIONS=[
  {value:"balanced",label:"Balanced â€” matched by handicap"},
  {value:"blindDraw",label:"Blind Draw â€” random assignment"},
  {value:"system",label:"System Pairing â€” GHIN-based"},
  {value:"none",label:"None â€” admin assigns manually"},
];

// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const uid=()=>Math.random().toString(36).slice(2,9);
const fullName=u=>`${u.firstName} ${u.lastName}`;
const initials=u=>`${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
const getMem=(group,userId)=>group.memberships.find(m=>m.userId===userId);
const canEdit=(group,userId)=>["superadmin","admin"].includes(getMem(group,userId)?.role);
const isSA=(group,userId)=>getMem(group,userId)?.role==="superadmin";
const getUser=(users,id)=>users.find(u=>u.id===id);
const getLoc=(group,id)=>group.locations.find(l=>l.id===id);
const groupGames=(games,gid)=>games.filter(g=>g.groupId===gid);

// â”€â”€ shared UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ AUTH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const AuthPage=({onAuth,onSetDb})=>{
  const [mode,setMode]=useState("login");
  const [step,setStep]=useState(1);
  const [f,setF]=useState({firstName:"",lastName:"",email:"",phone:"",password:"",handicap:"",ghin:""});
  const [g,setG]=useState({name:"",description:"",locName:"",locAddress:""});
  const [intent,setIntent]=useState("create");
  const [joinCode,setJoinCode]=useState("");
  const [errors,setErrors]=useState({});
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

  const finish=(db,setDb)=>{
    const newId="u"+uid();
    const newUser={id:newId,firstName:f.firstName,lastName:f.lastName,email:f.email,phone:f.phone,handicap:+f.handicap,ghin:f.ghin};
    if(intent==="join"){
      const target=db.groups.find(gr=>gr.id===joinCode||gr.name.toLowerCase().includes(joinCode.toLowerCase()));
      if(!target){setErrors({join:"Group not found."});return;}
      const updated={...target,memberships:[...target.memberships,{userId:newId,role:"player"}]};
      setDb(d=>({...d,users:[...d.users,newUser],groups:d.groups.map(gr=>gr.id===target.id?updated:gr)}));
    } else {
      if(!g.name.trim()){setErrors({gname:"Required"});return;}
      const newLoc={id:"l"+uid(),name:g.locName||"Home Course",address:g.locAddress||"",lat:33.5,lng:-84.5,teeTimeContact:{name:"",email:"",phone:""}};
      const newGroup={id:"g"+uid(),name:g.name,description:g.description,locations:[newLoc],memberships:[{userId:newId,role:"superadmin"}]};
      setDb(d=>({...d,users:[...d.users,newUser],groups:[...d.groups,newGroup]}));
    }
    onAuth(newId);
  };

  return (
    <div style={{minHeight:"100vh",background:S.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{width:"100%",maxWidth:440}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:56,height:56,borderRadius:16,background:S.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 12px"}}>â›³</div>
          <div style={{fontSize:24,fontWeight:800,color:S.text,letterSpacing:"-0.03em"}}>LinksInvite</div>
          <div style={{fontSize:13,color:S.textMuted,marginTop:4}}>Weekly Golf Coordinator</div>
        </div>
        <Card>
          <div style={{display:"flex",background:S.surface,borderRadius:10,padding:3,marginBottom:24}}>
            {["login","register"].map(m=>(
              <button key={m} onClick={()=>{setMode(m);setStep(1);setErrors({});}} style={{flex:1,padding:"8px 0",borderRadius:8,border:"none",fontFamily:"inherit",fontSize:13,fontWeight:600,cursor:"pointer",background:mode===m?S.card:"transparent",color:mode===m?S.accent:S.textMuted,textTransform:"capitalize"}}>{m}</button>
            ))}
          </div>

          {mode==="login"&&(
            <div>
              <Inp label="Email" value={f.email} onChange={sf("email")} placeholder="you@example.com" type="email"/>
              <Inp label="Password" value={f.password} onChange={sf("password")} placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" type="password"/>
              <Btn full onClick={()=>onAuth("u1")}>Sign in</Btn>
              <p style={{textAlign:"center",fontSize:12,color:S.textDim,marginTop:16}}>Demo: signs in as James Harrington (group owner)</p>
            </div>
          )}

          {mode==="register"&&step===1&&(
            <div>
              <div style={{fontSize:12,color:S.textMuted,marginBottom:16}}>Step 1 of 2 â€” Your account</div>
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
              <Btn full onClick={()=>{const e=v1();if(Object.keys(e).length){setErrors(e);return;}setErrors({});setStep(2);}}>Continue â†’</Btn>
            </div>
          )}

          {mode==="register"&&step===2&&(
            <div>
              <div style={{fontSize:12,color:S.textMuted,marginBottom:16}}>Step 2 of 2 â€” Your group</div>
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                {["create","join"].map(i=>(
                  <button key={i} onClick={()=>setIntent(i)} style={{flex:1,padding:"9px 0",borderRadius:8,border:`1px solid ${intent===i?S.accent:S.cardBorder}`,background:intent===i?S.accentSubtle:"transparent",color:intent===i?S.accent:S.textMuted,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                    {i==="create"?"âž• Create group":"ðŸ”— Join group"}
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
                <Btn variant="ghost" onClick={()=>setStep(1)}>â† Back</Btn>
                <Btn full onClick={()=>finish(SEED,v=>{onSetDb(v);})}>
                  {intent==="create"?"Create group & sign in":"Join & sign in"}
                </Btn>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

// â”€â”€ NAV â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TopNav=({page,setPage,user,group,groups,onGroupChange,onSignOut})=>{
  const [open,setOpen]=useState(false);
  const mem=group?getMem(group,user.id):null;
  return (
    <nav style={{background:S.surface,borderBottom:`1px solid ${S.cardBorder}`,padding:"0 20px",display:"flex",alignItems:"center",height:56,position:"sticky",top:0,zIndex:100,gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginRight:"auto"}}>
        <div style={{width:32,height:32,borderRadius:8,background:S.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>â›³</div>
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
        {[{id:"splash",label:"Games"},{id:"profile",label:"Profile"},...(group&&canEdit(group,user.id)?[{id:"admin",label:"Admin"}]:[])].map(({id,label})=>(
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

// â”€â”€ SPLASH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const WeatherWidget=({locationId})=>{
  const wx=(WEATHER[locationId]||WEATHER.l1);
  return (
    <Card style={{marginBottom:20}}>
      <SecTitle>3-Day Forecast</SecTitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
        {wx.map(w=>(
          <div key={w.day} style={{background:S.surface,borderRadius:10,padding:"14px 12px",textAlign:"center",border:`1px solid ${w.day==="Sat"?S.accent+"55":S.cardBorder}`}}>
            <div style={{fontSize:11,fontWeight:700,color:w.day==="Sat"?S.accent:S.textMuted,letterSpacing:"0.08em",marginBottom:6}}>{w.day}</div>
            <div style={{fontSize:26,marginBottom:6}}>{w.icon}</div>
            <div style={{fontSize:13,fontWeight:600,color:S.text,marginBottom:3}}>{w.hi}Â° / {w.lo}Â°</div>
            <div style={{fontSize:11,color:S.textMuted,marginBottom:8}}>{w.rain}% rain</div>
            <Badge color={w.rating==="Excellent"?S.accent:w.rating==="Good"?S.gold:w.rating==="Fair"?S.warning:S.danger} bg={w.rating==="Excellent"?S.accentSubtle:w.rating==="Good"?"#2a2000":w.rating==="Fair"?S.warningBg:S.dangerBg}>{w.rating}</Badge>
          </div>
        ))}
      </div>
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
          <div style={{fontSize:13,color:S.textMuted}}>{game.date} Â· {game.time}</div>
          {loc&&<div style={{fontSize:12,color:S.textDim,marginTop:2}}>ðŸ“ {loc.name}</div>}
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
        {regUsers.length===0?<p style={{margin:"0 0 8px",fontSize:13,color:S.textDim}}>No players yet â€” be the first to register.</p>:regUsers.map(u=><PlayerRow key={u.id} user={u}/>)}
      </div>
      {waitUsers.length>0&&(<div style={{marginTop:12}}><SecTitle>Waitlist</SecTitle>{waitUsers.map(u=><PlayerRow key={u.id} user={u} isWaitlist/>)}</div>)}
      <button onClick={()=>setExpanded(!expanded)} style={{background:"none",border:"none",color:S.accent,fontSize:12,fontWeight:600,cursor:"pointer",padding:"12px 0 4px",fontFamily:"inherit",display:"block",letterSpacing:"0.03em"}}>
        {expanded?"â–² Hide rules":"â–¼ View rules"}
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
      {primaryLoc&&<WeatherWidget locationId={primaryLoc.id}/>}
      {myGames.length===0?<Card><p style={{color:S.textMuted,textAlign:"center",margin:0}}>No games scheduled yet.</p></Card>:myGames.map(g=><GameCard key={g.id} game={g} group={group} user={user} users={users} onRegister={onRegister}/>)}
    </div>
  );
};

// â”€â”€ TEE TIME EMAIL MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      return `${hr}:${m2} ${ap}`;
    });
  };
  const [times,setTimes]=useState(genTimes().join(", "));
  const [note,setNote]=useState("");
  const [toName,setToName]=useState(contact.name||"");
  const [toEmail,setToEmail]=useState(contact.email||"");
  const [tab,setTab]=useState("compose");
  const [sent,setSent]=useState(false);
  const replyLink=`https://linksinvite.com/respond/${game.id}`;
  const preview=`Hi ${toName||"[Contact]"},\n\nI'm reaching out to reserve tee times for ${group.name}.\n\nGame details:\n  Date: ${game.date} (${game.day})\n  Players: ${game.maxPlayers} (${foursomes} foursomes)\n  Requested times: ${times}\n${note?`\nNotes: ${note}\n`:""}\nPlease confirm or suggest alternates:\n  â†’ ${replyLink}\n\nThank you,\n${fullName(adminUser)}\n${adminUser.email} Â· ${adminUser.phone}`;

  const handleSend=()=>{
    onSend({id:"ttr"+uid(),sentAt:new Date().toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}),requestedTimes:times.split(",").map(t=>t.trim()).filter(Boolean),players:game.maxPlayers,toName,toEmail,status:"pending",response:null});
    setSent(true);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:S.card,border:`1px solid ${S.cardBorder}`,borderRadius:16,width:"100%",maxWidth:580,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{padding:"18px 22px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:S.text}}>Request Tee Times</div>
            <div style={{fontSize:12,color:S.textMuted,marginTop:2}}>{location?.name} Â· {game.date}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:S.textMuted,fontSize:20,cursor:"pointer",padding:"0 4px"}}>âœ•</button>
        </div>
        {sent?(
          <div style={{padding:"32px 22px",textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:12}}>ðŸ“§</div>
            <div style={{fontSize:16,fontWeight:700,color:S.accent,marginBottom:8}}>Email queued</div>
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
                    âš  No tee time contact saved for this location. Add one in the Locations tab.
                  </div>
                )}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <Inp label="Contact name" value={toName} onChange={setToName} placeholder="Pro shop contact"/>
                  <Inp label="Contact email" type="email" value={toEmail} onChange={setToEmail} placeholder="proshop@course.com" required/>
                </div>
                <Divider/>
                <div style={{background:S.surface,borderRadius:8,padding:"10px 12px",marginBottom:14,fontSize:12,color:S.textMuted}}>
                  {foursomes} foursome{foursomes!==1?"s":""} Â· {game.maxPlayers} players Â· starting {game.time}
                </div>
                <Inp label="Requested tee times (comma-separated)" value={times} onChange={setTimes} hint="One per foursome â€” edit as needed"/>
                <TA label="Additional notes (optional)" value={note} onChange={setNote} rows={2}/>
                <div style={{background:S.infoBg,border:`1px solid ${S.info}33`,borderRadius:8,padding:"10px 14px",fontSize:12,color:S.info,marginBottom:18,lineHeight:1.6}}>
                  ðŸ“© The email includes a <strong>one-click response link</strong>. The contact can confirm or offer alternates â€” response goes straight to your admin inbox.
                </div>
                <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                  <Btn variant="ghost" small onClick={()=>setTab("preview")}>Preview</Btn>
                  <Btn small onClick={handleSend} disabled={!toEmail.includes("@")}>Send Request</Btn>
                </div>
              </>
            )}
            {tab==="preview"&&(
              <>
                <div style={{background:S.surface,borderRadius:10,padding:"16px 18px",fontFamily:"monospace",fontSize:12,color:S.text,lineHeight:1.8,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
                  <div style={{marginBottom:12,paddingBottom:12,borderBottom:`1px solid ${S.cardBorder}`}}>
                    <span style={{color:S.textMuted}}>To: </span>{toName?`${toName} <${toEmail}>`:toEmail||"â€”"}{"\n"}
                    <span style={{color:S.textMuted}}>From: </span>{fullName(adminUser)} &lt;{adminUser.email}&gt;{"\n"}
                    <span style={{color:S.textMuted}}>Subject: </span>Tee Time Request â€” {group.name} Â· {game.date}
                  </div>
                  <span style={{color:S.textMuted,fontFamily:"inherit",fontSize:11}}>{preview}</span>
                </div>
                <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:14}}>
                  <Btn variant="ghost" small onClick={()=>setTab("compose")}>â† Edit</Btn>
                  <Btn small onClick={handleSend} disabled={!toEmail.includes("@")}>Send Request</Btn>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// â”€â”€ TEE TIME REQUESTS PANEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
                {req.toEmail&&<span style={{fontWeight:400,color:S.textMuted}}> Â· {req.toEmail}</span>}
              </div>
              <div style={{fontSize:11,color:S.textDim,marginTop:2}}>{req.sentAt}</div>
            </div>
            <Badge color={req.status==="responded"?S.accent:S.warning} bg={req.status==="responded"?S.accentSubtle:S.warningBg}>
              {req.status==="responded"?"Responded":"Awaiting reply"}
            </Badge>
          </div>
          <div style={{fontSize:12,color:S.textMuted,marginBottom:req.response?10:0}}>
            Requested: {req.requestedTimes?.join(" Â· ")} Â· {req.players} players
          </div>
          {req.response&&(
            <div style={{background:req.response.type==="confirmed"?S.accentSubtle:S.warningBg,border:`1px solid ${req.response.type==="confirmed"?S.accent+"44":S.warning+"44"}`,borderRadius:8,padding:"10px 12px"}}>
              <div style={{fontSize:12,fontWeight:600,color:req.response.type==="confirmed"?S.accent:S.warning,marginBottom:4}}>
                {req.response.type==="confirmed"?"âœ“ Confirmed":"â†» Alternate times offered"}
                <span style={{fontWeight:400,color:S.textMuted,marginLeft:8}}>{req.response.respondedAt}</span>
              </div>
              {req.response.confirmedTime&&<div style={{fontSize:13,color:S.text,marginBottom:4}}>Tee time: <strong>{req.response.confirmedTime}</strong></div>}
              {req.response.alternateTimes&&<div style={{fontSize:13,color:S.text,marginBottom:4}}>Alternates: <strong>{req.response.alternateTimes.join(", ")}</strong></div>}
              {req.response.note&&<div style={{fontSize:12,color:S.textMuted,marginTop:4,lineHeight:1.5}}>"{req.response.note}"</div>}
            </div>
          )}
          {req.status==="pending"&&(
            <button onClick={()=>onSimulateResponse(game.id,req.id)} style={{marginTop:8,background:"none",border:`1px dashed ${S.textDim}`,borderRadius:6,padding:"4px 10px",fontSize:11,color:S.textDim,cursor:"pointer",fontFamily:"inherit"}}>
              â†» Simulate response (demo)
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

// â”€â”€ LOCATIONS TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    onUpdate({...group,locations:[...group.locations,{id:"l"+uid(),name:newLoc.name,address:newLoc.address,lat:33.5,lng:-84.5,teeTimeContact:newLoc.teeTimeContact}]});
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
              <div style={{fontSize:20}}>ðŸ“</div>
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
                  <span style={{fontSize:12,color:S.textDim,fontStyle:"italic"}}>None saved â€” add one to enable tee time requests</span>
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

// â”€â”€ GAME FORM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const GameForm=({game,group,adminUser,onSave,onCancel,onSendRequest})=>{
  const isNew=!game;
  const [form,setForm]=useState(game||{day:"Saturday",date:"",time:"8:00 AM",locationId:group.locations[0]?.id||"",description:"",rules:"",pairingMethod:"balanced",assignFoursomes:true,maxPlayers:16,recurring:false});
  const [saved,setSaved]=useState(false);
  const [showModal,setShowModal]=useState(false);
  const sf=(k,v)=>setForm(f=>({...f,[k]:v}));
  const selLoc=getLoc(group,form.locationId);
  const contact=selLoc?.teeTimeContact||{};
  const hasContact=!!(contact.email||contact.name);
  const lastReq=game?.teeTimeRequests?.slice(-1)[0];

  const handleSave=()=>{
    const out=isNew?{...form,id:"gm"+uid(),groupId:group.id,registrations:[],waitlist:[],teeTimeRequests:[]}:{...game,...form};
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
          <h2 style={{margin:0,fontSize:17,fontWeight:700,color:S.text}}>{isNew?"New Game":game.day+" â€” Edit"}</h2>
          <div style={{display:"flex",gap:8}}>
            {onCancel&&<Btn variant="ghost" small onClick={onCancel}>Cancel</Btn>}
            <Btn variant={saved?"ghost":"primary"} small onClick={handleSave}>{saved?"âœ“ Saved":"Save Game"}</Btn>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          <Sel label="Day" value={form.day} onChange={v=>sf("day",v)} options={["Saturday","Sunday","Monday","Tuesday","Wednesday","Thursday","Friday"].map(d=>({value:d,label:d}))}/>
          <Inp label="Date" value={form.date} onChange={v=>sf("date",v)} placeholder="June 7, 2025" required/>
          <Inp label="Tee Time" value={form.time} onChange={v=>sf("time",v)} placeholder="8:00 AM" required/>
        </div>
        <Sel label="Location" value={form.locationId} onChange={v=>sf("locationId",v)} options={group.locations.map(l=>({value:l.id,label:l.name}))}/>

        {/* Tee time contact callout */}
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
              <div style={{fontSize:12,color:S.warning}}>No contact saved for {selLoc?.name||"this location"} â€” add one in the Locations tab.</div>
            )}
            {lastReq&&(
              <div style={{fontSize:11,color:S.textDim,marginTop:3}}>
                Last request: {lastReq.sentAt} Â· <span style={{color:lastReq.status==="responded"?S.accent:S.warning}}>{lastReq.status==="responded"?"Response received":"Awaiting reply"}</span>
              </div>
            )}
          </div>
          {!isNew&&hasContact&&<Btn variant="info" small onClick={()=>setShowModal(true)}>ðŸ“§ Request Tee Times</Btn>}
          {!isNew&&!hasContact&&<span style={{fontSize:11,color:S.textDim}}>Save a contact to enable requests</span>}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}>
          <div/>
          <Inp label="Max Players" type="number" value={form.maxPlayers} onChange={v=>sf("maxPlayers",parseInt(v)||0)}/>
        </div>
        <Tog label="Recurring game" value={form.recurring} onChange={v=>sf("recurring",v)} hint="Auto-creates next week's game after this one closes"/>
        <Tog label="Assign foursomes" value={form.assignFoursomes} onChange={v=>sf("assignFoursomes",v)} hint="System auto-assigns players by pairing method"/>
        {form.assignFoursomes&&<Sel label="Pairing method" value={form.pairingMethod} onChange={v=>sf("pairingMethod",v)} options={PAIRING_OPTIONS}/>}
        <TA label="Description" value={form.description} onChange={v=>sf("description",v)}/>
        <TA label="Rules" value={form.rules} onChange={v=>sf("rules",v)}/>
      </Card>
    </>
  );
};

// â”€â”€ MEMBERS TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
              <div style={{fontSize:12,color:S.textMuted}}>{u.email} Â· HCP {u.handicap}</div>
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

// â”€â”€ ADMIN PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const AdminPage=({group,user,users,games,onUpdateGroup,onSaveGame,onDeleteGame,onSendRequest,onSimulateResponse})=>{
  const [tab,setTab]=useState("games");
  const [showNew,setShowNew]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const superAdmin=isSA(group,user.id);
  const myGames=groupGames(games,group.id);
  const tabs=[{id:"games",label:"Games"},{id:"locations",label:"Locations"},...(superAdmin?[{id:"members",label:"Members & Roles"},{id:"settings",label:"Group Settings"}]:[])];

  return (
    <div style={{maxWidth:780,margin:"0 auto",padding:"24px 16px"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <h1 style={{margin:0,fontSize:22,fontWeight:800,color:S.text,letterSpacing:"-0.02em"}}>Admin Panel</h1>
            <RoleBadge role={getMem(group,user.id)?.role||"player"}/>
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
          {myGames.map(g=>(
            <div key={g.id}>
              {editingId===g.id?(
                <GameForm game={g} group={group} adminUser={user} onSave={u=>{onSaveGame(u);setEditingId(null);}} onCancel={()=>setEditingId(null)} onSendRequest={onSendRequest}/>
              ):(
                <Card style={{marginBottom:16}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                    <div>
                      <div style={{fontSize:16,fontWeight:700,color:S.text}}>{g.day} Â· {g.date} Â· {g.time}</div>
                      <div style={{fontSize:12,color:S.textMuted,marginTop:3}}>
                        {getLoc(group,g.locationId)?.name} Â· {g.registrations.length}/{g.maxPlayers} players
                        {g.recurring&&<span style={{marginLeft:8,color:S.accent}}>â†» Recurring</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <Btn variant="ghost" small onClick={()=>setEditingId(g.id)}>Edit</Btn>
                      <Btn variant="danger" small onClick={()=>onDeleteGame(g.id)}>Delete</Btn>
                    </div>
                  </div>
                  {g.registrations.length>0&&(
                    <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${S.cardBorder}33`}}>
                      <div style={{fontSize:11,color:S.textMuted,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Roster</div>
                      {g.registrations.map(uid2=>{
                        const u2=getUser(users,uid2);
                        return u2?(<div key={uid2} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0"}}><Avatar user={u2} size={26}/><span style={{fontSize:13,color:S.text}}>{fullName(u2)}</span><span style={{fontSize:12,color:S.textMuted}}>HCP {u2.handicap}</span></div>):null;
                      })}
                    </div>
                  )}
                  <TeeTimePanel game={g} location={getLoc(group,g.locationId)} onSimulateResponse={onSimulateResponse}/>
                </Card>
              )}
            </div>
          ))}
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
        <Btn onClick={()=>{onUpdate({...group,name,description:desc});setSaved(true);setTimeout(()=>setSaved(false),2000);}} variant={saved?"ghost":"primary"}>{saved?"âœ“ Saved":"Save Settings"}</Btn>
      </div>
    </>
  );
};

// â”€â”€ PROFILE PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
            <div style={{fontSize:13,color:S.textMuted,marginTop:2}}>HCP <strong style={{color:S.accent}}>{p.handicap||"â€”"}</strong>{p.ghin&&<span style={{marginLeft:12}}>GHIN {p.ghin}</span>}</div>
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
          <Btn onClick={()=>{const e=validate();if(Object.keys(e).length){setErrors(e);return;}onUpdateUser({...p,handicap:+p.handicap});setSaved(true);setTimeout(()=>setSaved(false),2500);}} variant={saved?"ghost":"primary"}>{saved?"âœ“ Saved":"Save Profile"}</Btn>
        </div>
      </Card>
      <Card style={{marginTop:20}}>
        <SecTitle>My Groups</SecTitle>
        {myGroups.length===0?<p style={{color:S.textMuted,fontSize:13,margin:0}}>You haven't joined any groups yet.</p>:myGroups.map(g=>{
          const m=getMem(g,user.id);
          return(<div key={g.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${S.cardBorder}33`}}><div><div style={{fontSize:14,fontWeight:600,color:S.text}}>{g.name}</div><div style={{fontSize:12,color:S.textMuted}}>{g.memberships.length} members Â· {g.locations.length} location{g.locations.length!==1?"s":""}</div></div><RoleBadge role={m?.role||"player"}/></div>);
        })}
      </Card>
      {myGames.length>0&&(
        <Card style={{marginTop:20}}>
          <SecTitle>Upcoming Games</SecTitle>
          {myGames.map(g=>{
            const grp=groups.find(gr=>gr.id===g.groupId);
            return(<div key={g.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${S.cardBorder}33`}}><div><div style={{fontSize:14,fontWeight:600,color:S.text}}>{g.day} Â· {g.date}</div><div style={{fontSize:12,color:S.textMuted}}>{g.time} Â· {grp?.name}</div></div><Badge>Registered</Badge></div>);
          })}
        </Card>
      )}
    </div>
  );
};

// â”€â”€ APP ROOT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function App(){
  const [db,setDb]=useState(SEED);
  const [userId,setUserId]=useState(null);
  const [page,setPage]=useState("splash");
  const [groupId,setGroupId]=useState(null);

  const user=db.users.find(u=>u.id===userId);
  const myGroups=db.groups.filter(g=>g.memberships.some(m=>m.userId===userId));
  const group=db.groups.find(g=>g.id===groupId);

  useEffect(()=>{if(userId&&!groupId&&myGroups.length>0)setGroupId(myGroups[0].id);},[userId,myGroups.length,groupId]);

  if(!userId)return(
    <AuthPage
      onAuth={id=>{setUserId(id);setPage("splash");}}
      onSetDb={newDb=>setDb(newDb)}
    />
  );

  const handleRegister=gameId=>setDb(d=>({...d,games:d.games.map(g=>{
    if(g.id!==gameId)return g;
    const isReg=g.registrations.includes(userId);
    const isWait=g.waitlist.includes(userId);
    const isFull=g.registrations.length>=g.maxPlayers;
    if(isReg)return{...g,registrations:g.registrations.filter(id=>id!==userId)};
    if(isWait)return{...g,waitlist:g.waitlist.filter(id=>id!==userId)};
    if(isFull)return{...g,waitlist:[...g.waitlist,userId]};
    return{...g,registrations:[...g.registrations,userId]};
  })}));

  const handleSaveGame=game=>setDb(d=>({...d,games:d.games.some(g=>g.id===game.id)?d.games.map(g=>g.id===game.id?game:g):[...d.games,game]}));
  const handleDeleteGame=gameId=>setDb(d=>({...d,games:d.games.filter(g=>g.id!==gameId)}));
  const handleUpdateGroup=updated=>setDb(d=>({...d,groups:d.groups.map(g=>g.id===updated.id?updated:g)}));
  const handleUpdateUser=updated=>setDb(d=>({...d,users:d.users.map(u=>u.id===updated.id?updated:u)}));

  const handleSendRequest=(gameId,request)=>setDb(d=>({...d,games:d.games.map(g=>g.id===gameId?{...g,teeTimeRequests:[...(g.teeTimeRequests||[]),request]}:g)}));

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
      {group&&<TopNav page={page} setPage={setPage} user={user} group={group} groups={myGroups} onGroupChange={id=>{setGroupId(id);setPage("splash");}} onSignOut={()=>{setUserId(null);setGroupId(null);setPage("splash");}}/>}
      {page==="splash"&&group&&<SplashPage group={group} user={user} users={db.users} games={db.games} onRegister={handleRegister}/>}
      {page==="admin"&&group&&canEdit(group,userId)&&<AdminPage group={group} user={user} users={db.users} games={db.games} onUpdateGroup={handleUpdateGroup} onSaveGame={handleSaveGame} onDeleteGame={handleDeleteGame} onSendRequest={handleSendRequest} onSimulateResponse={handleSimulateResponse}/>}
      {page==="profile"&&user&&<ProfilePage user={user} groups={db.groups} games={db.games} onUpdateUser={handleUpdateUser}/>}
    </div>
  );
}
