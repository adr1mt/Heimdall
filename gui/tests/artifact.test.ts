import { expect,it } from 'vitest'
import { parseArtifact } from '../src/shared/artifact'
import { gradesOnly } from '../src/shared/backup'
import { validRun } from './fixtures/valid-run'

it.each([
 (r:any)=>r.students[0].checks=null,
 (r:any)=>r.students[0].checks=[],
 (r:any)=>r.students[0].checks[0].weight=null,
 (r:any)=>r.students[0].checks[0].check_id='unknown',
 (r:any)=>r.students[0].checks[0].cause='TIMEOUT',
 (r:any)=>r.students[0].checks[0].assertion.matched=false,
 (r:any)=>r.students[0].checks[0].execution.completed=false,
 (r:any)=>r.students[0].checks[0].execution=null,
 (r:any)=>r.students[0].score.final_score=99,
 (r:any)=>r.students[0].score.obtained=0.5,
 (r:any)=>r.students[0].status='PARTIAL',
 (r:any)=>r.plan.check_count=2,
 (r:any)=>r.plan.total_weight=2,
 (r:any)=>r.plan.check_ids=['c','c'],
 (r:any)=>r.students.push(structuredClone(r.students[0])),
 (r:any)=>r.status='PARTIAL'
])('rejects corruption instead of trusting its score',mutate=> {
 const run=validRun();mutate(run);expect(()=>parseArtifact(JSON.stringify(run))).toThrow(/incompleto|incoherente/)
})
it('accepts a legitimate grades-only backup',()=>expect(parseArtifact(JSON.stringify(gradesOnly(validRun()))).students[0].score.final_score).toBe(100))
it('accepts cancelled and excluded cases explicitly',()=> {
 const run=validRun();run.status='CANCELLED';expect(parseArtifact(JSON.stringify(run)).status).toBe('CANCELLED')
 run.status='COMPLETE';run.students[0].status='EXCLUDED';run.students[0].checks=[];run.students[0].score={obtained:0,evaluable:0,total:1,unevaluated:0,final_score:null,provisional_score:null,status:'EXCLUDED'}
 expect(parseArtifact(JSON.stringify(run)).students[0].status).toBe('EXCLUDED')
})
