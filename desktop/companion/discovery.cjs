'use strict';
// Server ID/name catalog adapted from MIT-licensed SkeeveTV/Aion-DPS-Meter
// (Copyright 2026 SkeeveTV). See capture/THIRD-PARTY-NOTICES.md.
// Block 1=NA East, 2=NA West, 3=EU, 4=LATAM, 5=Asia.
// IDs may change as NCSOFT updates Global server configuration.
const names = {"Elyos13":["Siel","Nezekan","Vaizel","Kaisinel","Yustiel","Ariel","Fregion","Meslamtaeda","Hithanya","Nania","Tahavatha","Luteros","Phernos","Daminu","Kasaka","Bakarma","Tsenka","Kochi","Ishtar","Tiamat","Gauss","Lamuatan","Nathara","Talisra","Zumion","Nahid","Asahr","Caelid","Laveis","Perion","Dramata","Reda","Auldor","Vakron","Narun","Gartua","Chloris","Ione","Teina","Dymones","Bargott","Atheron","Ruthilis","Siliator","Idris","Satia","Estian","Rahu","Rhanman","Hebran","Urahum","Lakshmi","Thamon","Tiere","Duduri","Derkos","Dundu","Holyaul","Poeta","Verteron"],"Elyos10":["Siel","Nezekan","Vaizel","Kaisinel","Yustiel","Ariel","Fregion","Meslamtaeda","Hithanya","Nania","Tahavatha","Luteros","Phernos","Daminu","Kasaka","Bakarma","Tsenka","Kochi","Ishtar","Tiamat","Poeta","Verteron","Nathara","Talisra","Zumion","Nahid","Asahr","Caelid","Laveis","Perion","Dramata","Reda","Auldor","Vakron","Narun","Gartua","Chloris","Ione","Teina","Dymones","Bargott","Atheron","Ruthilis","Siliator","Idris","Satia","Estian","Rahu","Rhanman","Hebran","Urahum","Lakshmi","Thamon","Tiere","Duduri","Derkos","Dundu","Holyaul"],"Asmo23":["Israphel","Zikel","Triniel","Lumiel","Marchutan","Azphel","Ereshkigal","Beritra","Nemon","Hadala","Ludra","Ulgorn","Munin","Odar","Zemurru","Kromede","Quai","Baba","Fafnir","Indnath","Agnita","Atiel","Tassin","Heladrir","Valdemar","Lagta","Gerod","Urd","Ecco","Giselle","Kashapa","Stof","Berk","Nuakum","Grisilla","Santras","Reuben","Hugo","Kraki","Hystan","Rathman","Sigebert","Nazmun","Gelcos","Paton","Pelleir","Elvida","Ketu","Pydeon","Notun","Murute","Rotan","Kwapo","Duanka","Brok","Valter","Purakhi","Ignus","Ishalgen","Altgard"],"Asmo20":["Israphel","Zikel","Triniel","Lumiel","Marchutan","Azphel","Ereshkigal","Beritra","Nemon","Hadala","Ludra","Ulgorn","Munin","Odar","Zemurru","Kromede","Quai","Baba","Fafnir","Indnath","Ishalgen","Altgard","Agnita","Atiel","Valdemar","Lagta","Gerod","Urd","Ecco","Giselle","Kashapa","Stof","Berk","Nuakum","Grisilla","Santras","Reuben","Hugo","Kraki","Hystan","Rathman","Sigebert","Nazmun","Gelcos","Paton","Pelleir","Elvida","Ketu","Pydeon","Notun","Murute","Rotan","Kwapo","Duanka","Brok","Valter","Purakhi","Ignus"]};
const regions = {1:['NA East',9],2:['NA West',5],3:['Europe',23],4:['LATAM',6],5:['Asia',10]};
function describeServer(id) {
  const num = Number(id);
  if (!Number.isInteger(num) || num<1 || num>9999) return {id:null,name:'Unknown server',aliases:[]};
  const faction = Math.floor(num/1000), block=Math.floor(num/100)%10, index=num%100-1;
  const table = faction===1?(block===0?names.Elyos10:names.Elyos13):faction===2?(block===0?names.Asmo20:names.Asmo23):[];
  if (index<0 || index>=table.length || block>5) return {id:num,name:'Aion 2 server '+num,aliases:[]};
  const name=table[index], region=regions[block];
  const full=region&&index<region[1]?region[0]+' - '+name:name+' ['+num+']';
  return {id:num,name:full,aliases:[name,full,name+' ['+num+']','Aion 2 server '+num],
    faction:faction===1?'Elyos':'Asmodian'};
}
function norm(v) { return String(v||'').trim().toLowerCase().replace(/\s+/g,' '); }
function sameName(a,b) { return norm(a)===norm(b); }
function serverMatches(server,serverId) {
  const d=describeServer(serverId);
  return d.aliases.some(s=>norm(s)===norm(server));
}
function findDiscovered(profiles,character,serverId) {
  return profiles.find(p=>sameName(p.character,character) && (
    Number(p.serverId)===Number(serverId) ||
    (!p.serverId && serverMatches(p.server,serverId))
  ))||null;
}
function discoverProfile(profiles,character,serverId) {
  const name=String(character||'').trim(),id=Number(serverId);
  if(!name || name.length>40 || !Number.isInteger(id) || id<1 || id>9999) return {profiles,profile:null,changed:false};
  const existing=findDiscovered(profiles,name,id);
  if(existing){
    if(existing.serverId===id)return {profiles,profile:existing,changed:false};
    const updated={...existing,serverId:id,detected:true};
    return {profiles:profiles.map(p=>p===existing?updated:p),profile:updated,changed:true};
  }
  if(profiles.length>=80)return {profiles,profile:null,changed:false};
  const profile={character:name,server:describeServer(id).name,serverId:id,detected:true};
  return {profiles:[...profiles,profile],profile,changed:true};
}
module.exports={describeServer,sameName,serverMatches,findDiscovered,discoverProfile};
