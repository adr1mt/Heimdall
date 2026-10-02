import type { RunResult } from '../../src/shared/artifact'

/** A complete artifact, including the evidence that supports its grade. */
export function validRun(): RunResult {
 const at='2026-10-02T10:00:00Z'
 return {
  schema_version:1,run_id:'R1',engine_version:'test',started_at:at,finished_at:at,status:'COMPLETE',
  exam:{path:'examen.yaml',sha256:'a'.repeat(64)},inventory:{path:'aula.yaml',sha256:'b'.repeat(64)},plan_hash:'c'.repeat(64),
  plan:{check_count:1,total_weight:1,check_ids:['c'],concurrency:16,host_concurrency:4},
  students:[{student_id:'fake',name:'Ficticio',status:'OK',started_at:at,finished_at:at,
   score:{obtained:1,evaluable:1,total:1,unevaluated:0,provisional_score:100,final_score:100,status:'COMPLETE'},
   checks:[{check_id:'c',group:'G',description:'C',weight:1,status:'PASS',cause:'NONE',
    execution:{host:'',address:'',user:'',transport:'inventory',command:[],started_at:at,duration_ms:0,completed:true,exit_code:0,overflow:false,stdout:{text:'yes',bytes:3,bytes_total:3,truncated:false},stderr:{text:'',bytes:0,bytes_total:0,truncated:false},connect_attempts:0,command_attempts:0,remote_process:'FINISHED'},
    assertion:{kind:'equals',expected:'yes',found:'yes',matched:true}}]}]
 }
}
