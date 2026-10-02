// The canonical artifact, as the GUI reads it. It is the source of truth: the
// event stream only says what is happening, and everything the teacher is
// shown on the results screen comes from here (ADR-0007,
// docs/design/04-MODELO-RESULTADO.md).

import type {
  AcademicStatus,
  PlanSummary,
  RunStatus,
  Score,
  StudentStatus,
  Warning
} from './events'

/** The schema version this build knows how to read. */
export const SCHEMA_VERSION = 1

export type Cause =
  | 'NONE'
  | 'CONNECT_FAILED'
  | 'AUTH_FAILED'
  | 'TIMEOUT'
  | 'CONNECTION_LOST'
  | 'NOT_RUN'
  | 'CANCELLED'
  | 'OUTPUT_OVERFLOW'
  | 'ENGINE_ERROR'

export type RemoteProcess = 'FINISHED' | 'KILLED_REMOTE' | 'UNKNOWN'

export interface SourceRef {
  path: string
  sha256: string
  version?: string
}

/** One captured stream. The student's output is untrusted data, and capped. */
export interface Stream {
  text: string
  bytes: number
  bytes_total: number
  truncated: boolean
}

/** The facts about the process. It knows nothing about grades. */
export interface ExecutionResult {
  host: string
  address: string
  user: string
  transport: string
  command: string[]
  started_at: string
  duration_ms: number
  completed: boolean
  exit_code: number | null
  overflow: boolean
  stdout: Stream
  stderr: Stream
  connect_attempts: number
  command_attempts: number
  remote_process: RemoteProcess
}

/** What was compared and what was found. No grade. */
export interface AssertionResult {
  evidence_truncated?: boolean
  kind: string
  expected: string
  found: string
  matched: boolean
  where?: string
}

/**
 * What this same check was in the run that this one repeated. It is a record,
 * not a result: no grade is computed from it, and the run it names still holds
 * its own artifact with the full evidence (ADR-0018).
 */
export interface PreviousAttempt {
  run_id: string
  status: AcademicStatus
  cause: Cause
  detail?: string
  finished_at: string
}

/** The run this one repeated, and how much of it. */
export interface RetryRef {
  run_id: string
  artifact: string
  run_at: string
  students: number
  checks: number
}

export interface CheckResult {
  check_id: string
  group: string
  description: string
  weight: number
  status: AcademicStatus
  cause: Cause
  detail?: string
  execution: ExecutionResult | null
  assertion: AssertionResult | null
  previous?: PreviousAttempt
}

export interface StudentResult {
  student_id: string
  name: string
  moodle_id?: string
  status: StudentStatus
  started_at: string
  finished_at: string
  score: Score
  checks: CheckResult[]
}

export interface RunResult {
  schema_version: number
  run_id: string
  engine_version: string
  started_at: string
  finished_at: string
  status: RunStatus
  exam: SourceRef
  inventory: SourceRef
  plan_hash: string
  plan: PlanSummary
  students: StudentResult[]
  warnings?: Warning[]
  /** Set when this run repeated what an earlier one left unevaluated. */
  retry_of?: RetryRef
}

/**
 * Reads an artifact. It refuses a schema it does not know instead of guessing:
 * a field that changed meaning would be read as a grade that is not there.
 * Anything beyond the fields this build knows is left alone, which is what
 * lets a newer engine add one without breaking this screen.
 */
export function parseArtifact(text: string): RunResult {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('El fichero de resultados no es un JSON válido.')
  }
  if (typeof value !== 'object' || value === null) {
    throw new Error('El fichero de resultados no tiene la forma de un resultado.')
  }
  const run = value as Partial<RunResult>
  if (run.schema_version !== SCHEMA_VERSION) {
    throw new Error(
      `El resultado está escrito en la versión ${String(run.schema_version)} del formato y la aplicación entiende la ${SCHEMA_VERSION}.`
    )
  }
  if (!Array.isArray(run.students) || !run.plan) {
    throw new Error('El fichero de resultados está incompleto.')
  }
  validateArtifact(value)
  // A student nobody evaluated carries no checks, and that is written as
  // nothing at all. It is read as «ninguna comprobación», which is what it
  // means: an excluded student is the ordinary case since a round of an exam
  // session leaves out whoever already finished (T063).
  for (const student of run.students) {
    if (student.status==='EXCLUDED' && student.checks===null) student.checks = []
  }
  return run as RunResult
}

const CAUSES = ['CONNECT_FAILED','AUTH_FAILED','TIMEOUT','CONNECTION_LOST','NOT_RUN','CANCELLED','OUTPUT_OVERFLOW','ENGINE_ERROR']

/** Verifies the published grade against its evidence without changing it. */
function validateArtifact(value: unknown): void {
 const bad=(at:string,why:string):never=> {throw new Error(`El resultado está incompleto o es incoherente (${at}): ${why}.`)}
 const object=(v:unknown,at:string):Record<string,unknown>=> v && typeof v==='object' && !Array.isArray(v) ? v as Record<string,unknown> : bad(at,'se esperaba un objeto')
 const text=(v:unknown,at:string,nonempty=false):string=> typeof v==='string' && (!nonempty || !!v.trim()) ? v : bad(at,'texto inválido')
 const number=(v:unknown,at:string,integer=false):number=> typeof v==='number' && Number.isFinite(v) && v>=0 && (!integer || Number.isInteger(v)) ? v : bad(at,'número inválido')
 const list=(v:unknown,at:string):unknown[]=> Array.isArray(v) ? v : bad(at,'se esperaba una lista')
 const date=(v:unknown,at:string):number=> {const d=Date.parse(text(v,at,true));return Number.isFinite(d)?d:bad(at,'fecha inválida')}
 const close=(a:number,b:number):boolean=> a===b || Math.abs(a-b)<=1e-12*Math.max(Math.abs(a),Math.abs(b))
 const statusCause=(c:Record<string,unknown>,at:string):void=> {if((c.status==='PASS' || c.status==='FAIL') ? c.cause!=='NONE' : c.status!=='UNEVALUATED' || !CAUSES.includes(String(c.cause))) bad(at,'estado o causa inválidos')}
 const run=object(value,'run'),p=object(run.plan,'plan')
 text(run.run_id,'run_id',true);text(run.engine_version,'engine_version',true);text(run.plan_hash,'plan_hash',true)
 if(date(run.finished_at,'finished_at')<date(run.started_at,'started_at')) bad('run','fechas invertidas')
 for(const key of ['exam','inventory']) {const ref=object(run[key],key);text(ref.path,`${key}.path`,true);text(ref.sha256,`${key}.sha256`,true)}
 if (p.evidence_bytes_per_field !== undefined) {const limit=number(p.evidence_bytes_per_field,'evidence_bytes_per_field',true);if(limit<1 || limit>65536) bad('evidence_bytes_per_field','límite inválido')}
 const count=number(p.check_count,'check_count',true),total=number(p.total_weight,'total_weight'),ids=list(p.check_ids,'check_ids').map((id)=>text(id,'check_ids',true))
 if(count<1 || total<=0 || ids.length!==count || new Set(ids).size!==count || number(p.concurrency,'concurrency',true)<1 || number(p.host_concurrency,'host_concurrency',true)<1) bad('plan','cantidades inválidas')
 const warnings=run.warnings===undefined?[]:list(run.warnings,'warnings')
 const restored=warnings.some(w=>object(w,'warnings').code==='RESTORED_FROM_BACKUP')
 for(const w of warnings) {const warning=object(w,'warning');for(const key of ['scope','code','message']) text(warning[key],`warning.${key}`)}
 const students=list(run.students,'students'),seen=new Set<string>(),weights=new Map<string,number>()
 if(!students.length) bad('students','lista vacía')
 let partial=false
 for(const value of students) {
  const s=object(value,'student'),id=text(s.student_id,'student_id',true),at=`student:${id}`
  if(seen.has(id)) bad(at,'identificador repetido');seen.add(id);text(s.name,`${at}.name`)
  if(date(s.finished_at,`${at}.finished_at`)<date(s.started_at,`${at}.started_at`)) bad(at,'fechas invertidas')
  const score=object(s.score,`${at}.score`)
  for(const key of ['obtained','evaluable','total','unevaluated']) number(score[key],`${at}.score.${key}`)
  for(const key of ['provisional_score','final_score']) if(score[key]!==null && number(score[key],`${at}.${key}`,true)>100) bad(at,'nota fuera de escala')
  if(!close(score.total as number,total)) bad(at,'denominador distinto al PLAN')
  if(s.status==='EXCLUDED') {
   if(s.checks!==null && list(s.checks,`${at}.checks`).length!==0) bad(at,'excluido con comprobaciones')
   if(score.status!=='EXCLUDED' || score.final_score!==null || score.provisional_score!==null || score.obtained!==0 || score.evaluable!==0 || score.unevaluated!==0) bad(at,'excluido con nota')
   continue
  }
  const checks=list(s.checks,`${at}.checks`)
  if(checks.length!==count) bad(at,'faltan comprobaciones del PLAN')
  let obtained=0,evaluable=0,pending=0,sum=0,weighted=0,unseen=0
  for(const [i,v] of checks.entries()) {
   const c=object(v,`${at}.checks`),where=`${at}/check:${String(c.check_id)}`,weight=number(c.weight,`${where}.weight`)
   if(c.check_id!==ids[i]) bad(where,'id u orden distintos al PLAN')
   text(c.group,`${where}.group`);text(c.description,`${where}.description`)
   if(weights.has(ids[i]) && weights.get(ids[i])!==weight) bad(where,'pesos distintos entre alumnos');weights.set(ids[i],weight)
   sum+=weight;statusCause(c,where)
   if(weight>0) {weighted++;if(c.status==='UNEVALUATED') unseen++}
   if(c.status==='PASS') obtained+=weight
   if(c.status==='PASS' || c.status==='FAIL') evaluable+=weight
   else pending+=weight
   if(c.previous!==undefined) {const prev=object(c.previous,`${where}.previous`);text(prev.run_id,`${where}.previous.run_id`,true);statusCause(prev,where);date(prev.finished_at,`${where}.previous.finished_at`)}
   if(c.execution!==null) {
    const e=object(c.execution,`${where}.execution`)
    for(const key of ['host','address','user','transport']) text(e[key],`${where}.${key}`)
    if(e.command!==null) for(const arg of list(e.command,`${where}.command`)) text(arg,`${where}.command`)
    date(e.started_at,`${where}.started_at`)
    for(const key of ['duration_ms','connect_attempts','command_attempts']) number(e[key],`${where}.${key}`,true)
    if(typeof e.completed!=='boolean' || typeof e.overflow!=='boolean' || !['FINISHED','KILLED_REMOTE','UNKNOWN'].includes(String(e.remote_process))) bad(where,'ejecución inválida')
    if(e.exit_code!==null) {if(typeof e.exit_code!=='number' || !Number.isInteger(e.exit_code)) bad(where,'código inválido')}
    if(e.completed ? e.exit_code===null || e.overflow || e.remote_process!=='FINISHED' : e.exit_code!==null) bad(where,'terminación incoherente')
    for(const key of ['stdout','stderr']) {
     const stream=object(e[key],`${where}.${key}`);text(stream.text,`${where}.${key}.text`)
     const bytes=number(stream.bytes,`${where}.${key}.bytes`,true),all=number(stream.bytes_total,`${where}.${key}.bytes_total`,true)
     if(bytes>65536 || all<bytes || typeof stream.truncated!=='boolean' || (all>bytes && !stream.truncated)) bad(where,'flujo inválido')
    }
   }
   if(c.assertion!==null) {
    const a=object(c.assertion,`${where}.assertion`)
    if(a.evidence_truncated!==undefined && typeof a.evidence_truncated!=='boolean') bad(where,'marcador de evidencia inválido')
    for(const key of ['kind','expected','found']) text(a[key],`${where}.assertion.${key}`)
    if(!['contains','not_contains','equals','exit_code','near'].includes(String(a.kind)) || typeof a.matched!=='boolean' || (c.status==='PASS')!==a.matched || c.status==='UNEVALUATED') bad(where,'aserción incoherente')
   }
   if(c.status!=='UNEVALUATED' && !restored && (c.execution===null || c.assertion===null || !object(c.execution,where).completed)) bad(where,'falta evidencia del resultado')
  }
  if(!close(sum,total)) bad(at,'los pesos no suman el PLAN')
  const studentStatus=unseen===0?'OK':unseen===weighted?'NOT_EVALUATED':'PARTIAL'
  const scoreStatus=evaluable===0?'NOT_EVALUATED':pending>0?'INCOMPLETE':'COMPLETE'
  const provisional=evaluable===0?null:Math.round(100*(obtained/evaluable)),final=scoreStatus==='COMPLETE'?Math.round(100*(obtained/total)):null
  if(s.status!==studentStatus || score.status!==scoreStatus || !close(score.obtained as number,obtained) || !close(score.evaluable as number,evaluable) || !close(score.unevaluated as number,pending) || score.provisional_score!==provisional || score.final_score!==final) bad(at,'la nota o el estado no coinciden con las comprobaciones')
  if(studentStatus!=='OK') partial=true
 }
 if(run.status!=='CANCELLED' && run.status!==(partial?'PARTIAL':'COMPLETE')) bad('status','no coincide con los alumnos')
 if(run.retry_of!==undefined) {
  const retry=object(run.retry_of,'retry_of');text(retry.artifact,'retry_of.artifact',true);date(retry.run_at,'retry_of.run_at')
  const id=text(retry.run_id,'retry_of.run_id',true),n=number(retry.students,'retry_of.students',true),checks=number(retry.checks,'retry_of.checks',true)
  if(id===run.run_id || n<1 || n>students.length || checks<1 || checks>n*count) bad('retry_of','procedencia inválida')
 }
}
