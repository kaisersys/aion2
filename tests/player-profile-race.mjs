import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../src/lib/playerProfile.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText;
const {ensurePlayerProfile}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(js));

const profiles=new Map();
const attempts=[];
const client={
  from(table){
    assert.equal(table,'player_profiles');
    return {
      async upsert(input,options){
        attempts.push({input,options});
        assert.equal(options.onConflict,'user_id');
        assert.equal(options.ignoreDuplicates,true,
          'first-login writes must ignore an existing primary key, not create a duplicate or overwrite');
        await Promise.resolve();
        if(!profiles.has(input.user_id)){
          profiles.set(input.user_id,{...input,class_name:'',faction:''});
        }
        return {error:null};
      },
      select(columns){
        assert.equal(columns,'user_id,display_name,class_name,faction');
        return {
          eq(column,userId){
            assert.equal(column,'user_id');
            return {async single(){
              const data=profiles.get(userId)||null;
              return {data,error:data?null:{message:'Missing profile'}};
            }};
          }
        };
      }
    };
  }
};

const user={id:'player-uuid-1',email:'friend@example.com',user_metadata:{display_name:'New Daeva'}};
const [first,second]=await Promise.all([
  ensurePlayerProfile(client,user,null),
  ensurePlayerProfile(client,user,null)
]);
assert.deepEqual(first,second);
assert.equal(profiles.size,1);
assert.equal(attempts.length,2);
assert.equal(first.display_name,'New Daeva');

// A later sign-in must never reset preferences or even issue an insert.
const previous={...first,display_name:'Experienced Ranger',class_name:'Ranger',faction:'Elyos'};
profiles.set(user.id,previous);
const login=await ensurePlayerProfile(client,user,previous);
assert.deepEqual(login,previous);
assert.deepEqual(profiles.get(user.id),previous);
assert.equal(attempts.length,2);

// If a second tab saw an absent profile before a player saved their settings,
// the conflict-safe write must still preserve those settings.
const concurrent=await ensurePlayerProfile(client,user,null);
assert.deepEqual(concurrent,previous);
assert.deepEqual(profiles.get(user.id),previous);

console.log('PASS simultaneous first login creates one profile without duplicate-key errors');
console.log('PASS subsequent and stale sign-in requests never overwrite existing profile details');
