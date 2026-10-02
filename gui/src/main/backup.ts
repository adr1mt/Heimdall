import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { open, readdir, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { parseArtifact, type RunResult } from '../shared/artifact'
import { gradesOnly, type BackupEntry, type RestoreReport } from '../shared/backup'
import { MAX_ARTIFACT } from './artifact'
import { RUN_FILE, varDirOf } from './history'

/** Retain 50 recent heads and their dependencies, at most 2500 copies. */
export const MAX_BACKUPS = 50
export const MAX_BACKUP_CHAIN = 50

/** Where every copy lives: the app's own data directory, never the exam's. */
export function backupsRoot(dataDir: string): string {
  return join(dataDir, 'copias')
}

/**
 * The folder of one exam's copies. Named after the exam's folder so it can be
 * recognised by hand, and closed with a digest of the full path so two
 * «2smx-redes» in different places never share a slot.
 */
export function slotFor(dataDir: string, examPath: string): string {
  const dir = varDirOf(examPath)
  const digest = createHash('sha256').update(dir).digest('hex').slice(0, 12)
  const slug = basename(join(dir, '..')).replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 40) || 'examen'
  return join(backupsRoot(dataDir), `${slug}-${digest}`)
}

function runFilesIn(dir: string): string[] {
  try {
    return readdirSync(dir).filter((name) => RUN_FILE.test(name))
  } catch {
    return []
  }
}

/** Atomic: a power cut never leaves a half-written copy of a class's grades. */
function writeAtomic(path: string, text: string): void {
  const tmp = `${path}.tmp`
  writeFileSync(tmp, text, 'utf-8')
  renameSync(tmp, path)
}

/**
 * Copies the corrections of an exam that are not copied yet. It is called
 * after every correction, so the copy of a run is made the moment it exists,
 * and it repairs itself: a run whose copy was deleted is copied again on the
 * next pass.
 *
 * It never throws. A backup that fails must not take down the correction that
 * just finished; what it could not copy comes back as a count.
 */
export interface BackupReport { saved: number; failures: string[] }

// Serialise passes for the same slot: two close notifications must not race
// over temporary files or prune copies while another pass is writing them.
const passes=new Map<string,Promise<BackupReport>>()
export function backupRuns(dataDir:string,examPath:string):Promise<BackupReport> {
 const slot=slotFor(dataDir,examPath),previous=passes.get(slot) ?? Promise.resolve({saved:0,failures:[]})
 const next=previous.then(()=>copyRuns(dataDir,examPath))
 passes.set(slot,next)
 const release=():void=>{if(passes.get(slot)===next) passes.delete(slot)}
 void next.then(release,release)
 return next
}

export function hasPendingBackups():boolean {return passes.size>0}
export async function waitForBackups():Promise<void> {await Promise.allSettled(passes.values())}

async function copyRuns(dataDir:string,examPath:string):Promise<BackupReport> {
 const report:BackupReport={saved:0,failures:[]},sourceDir=varDirOf(examPath),slot=slotFor(dataDir,examPath)
 const failure=(path:string,error:unknown):void=> {report.failures.push(`${path}: ${error instanceof Error?error.message:String(error)}`)}
 async function names(dir:string):Promise<string[]> {
  try {return (await readdir(dir)).filter(name=>RUN_FILE.test(name))} catch(error) {if((error as NodeJS.ErrnoException).code!=='ENOENT') failure(dir,error);return []}
 }
 // Read bounded date headers for selection; full reads are restricted to
 // the latest heads and their dependency chains.
 async function dated(dir:string):Promise<{name:string;at:number}[]> {
  const entries=[]
  for(const name of await names(dir)) {
   const path=join(dir,name)
   try {
    const file=await open(path,'r')
    try {
     const buffer=Buffer.alloc(4096),{bytesRead}=await file.read(buffer,0,buffer.length,0)
     const found=buffer.toString('utf8',0,bytesRead).match(/"started_at"\s*:\s*"([^"\r\n]+)"/)
     const at=found?Date.parse(found[1]):NaN
     if(!Number.isFinite(at)) throw new Error('fecha de corrección ilegible en la cabecera')
     entries.push({name,at})
    } finally {await file.close()}
   } catch(error) {failure(path,error)}
  }
  return entries.sort((a,b)=>b.at-a.at || b.name.localeCompare(a.name))
 }
 // Load the whole dependency chain before writing any of its members.
 // A broken chain is reported, never offered as a recoverable correction.
 const cache = new Map<string, RunResult>()
 async function load(name:string):Promise<RunResult> {
  const cached=cache.get(name); if(cached) return cached
  if(!RUN_FILE.test(name)) throw new Error('nombre de antecedente inválido')
  let path=join(sourceDir,name)
  try {await stat(path)} catch(error) {
   if((error as NodeJS.ErrnoException).code!=='ENOENT') throw error
   path=join(slot,name)
  }
  if((await stat(path)).size>MAX_ARTIFACT) throw new Error('resultado demasiado grande para copiar')
  const run=parseArtifact(await readFile(path,'utf8')); cache.set(name,run); return run
 }
 async function chainOf(name:string):Promise<string[]> {
  const chain:string[]=[],seen=new Set<string>();let expected:string|undefined,hash:string|undefined
  while(true) {
   const run=await load(name)
   if(seen.has(run.run_id)) throw new Error('ciclo en la cadena de copias')
   if(expected && run.run_id!==expected) throw new Error('identidad de antecedente incorrecta')
   if(hash && run.plan_hash!==hash) throw new Error('antecedente de otro PLAN')
   hash=run.plan_hash;seen.add(run.run_id);chain.push(name)
   if(!run.retry_of) return chain
   if(chain.length>=MAX_BACKUP_CHAIN) throw new Error('cadena de copias demasiado larga')
   expected=run.retry_of.run_id;name=basename(run.retry_of.artifact)
  }
 }
 for(const {name} of (await dated(sourceDir)).slice(0,MAX_BACKUPS)) {
  try {
   const chain=await chainOf(name)
   // Oldest first: even an interrupted pass leaves no new orphaned head.
   for(const member of chain.reverse()) {
    const target=join(slot,member)
    try {await stat(target);continue} catch(error) {if((error as NodeJS.ErrnoException).code!=='ENOENT') throw error}
    await mkdir(slot,{recursive:true})
    const tmp=`${target}.tmp`
    try {await writeFile(tmp,`${JSON.stringify(gradesOnly(cache.get(member)!))}\n`,'utf8');await rename(tmp,target)} finally {await rm(tmp,{force:true}).catch(()=>undefined)}
    report.saved++
   }
  } catch(error) {failure(join(sourceDir,name),error)}
 }
 // Select from copies that actually exist, so a failed new copy cannot evict
 // an older recoverable one. Protect all dependencies of the latest 50 heads.
 const copies=new Map<string,RunResult>(),keep=new Set<string>()
 for(const name of await names(slot)) {
  try {
   if((await stat(join(slot,name))).size>MAX_ARTIFACT) throw new Error('copia demasiado grande')
   copies.set(name,parseArtifact(await readFile(join(slot,name),'utf8')))
  } catch(error) {failure(join(slot,name),error)}
 }
 let heads=0
 for(const [name] of [...copies].sort((a,b)=>Date.parse(b[1].started_at)-Date.parse(a[1].started_at)||b[0].localeCompare(a[0]))) {
  try {
   const chain=backupChain(name,copies)
   if(heads++<MAX_BACKUPS) for(const member of chain) keep.add(member)
  } catch(error) {failure(join(slot,name),error)}
 }
 for(const name of copies.keys()) if(!keep.has(name)) {
  try {await rm(join(slot,name))} catch(error) {failure(join(slot,name),error)}
 }
 return report
}

/** The copies of one exam, newest correction first. */
export function listBackups(dataDir: string, examPath: string): BackupEntry[] {
  const slot = slotFor(dataDir, examPath)
  const varDir = varDirOf(examPath)
  const entries: BackupEntry[] = []
  const copies = readBackupRuns(slot)
  for (const [name, run] of copies) {
    const path = join(slot, name)
    try {
      backupChain(name, copies)
      entries.push({
        path,
        runId: run.run_id,
        at: run.started_at,
        students: run.students.length,
        onDisk: existsSync(join(varDir, name))
      })
    } catch {
      // A copy that cannot be read is not a copy. It is skipped instead of
      // offering the teacher a restore that would write nothing.
    }
  }
  entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  return entries
}

/**
 * Puts the copies back into the exam's folder. A correction already there is
 * left exactly as it is: the artifact on disk holds the whole evidence and
 * the copy holds only the grades, so overwriting it would lower what the
 * teacher has. Restoring can only add corrections, never replace one.
 */
export function restoreBackups(dataDir: string, examPath: string): RestoreReport {
  const slot = slotFor(dataDir, examPath)
  const varDir = varDirOf(examPath)
  const report: RestoreReport = { restored: 0, kept: 0 }
  const copies = readBackupRuns(slot)
  const names = [...copies.keys()]
  for (const name of names) backupChain(name, copies)
  if (names.length === 0) throw new Error('No hay ninguna copia de seguridad de este examen.')
  for (const name of names) {
    const target = join(varDir, name)
    if (existsSync(target)) {
      report.kept += 1
      continue
    }
    const text = readFileSync(join(slot, name), 'utf-8')
    // Read before writing: a copy that is not an artifact is not restored.
    parseArtifact(text)
    mkdirSync(varDir, { recursive: true })
    writeAtomic(target, text)
    report.restored += 1
  }
  return report
}

function readBackupRuns(slot: string): Map<string, RunResult> {
  const runs = new Map<string, RunResult>()
  for (const name of runFilesIn(slot)) {
    try {
      if (statSync(join(slot, name)).size > MAX_ARTIFACT) continue
      runs.set(name, parseArtifact(readFileSync(join(slot, name), 'utf8')))
    } catch { /* Invalid copies are never offered for recovery. */ }
  }
  return runs
}

function backupChain(name: string, copies: Map<string, RunResult>): string[] {
  const chain: string[] = [], seen = new Set<string>()
  let expected: string | undefined, hash: string | undefined
  while (true) {
    const run = copies.get(name)
    if (!run) throw new Error(`Falta el antecedente ${name} en las copias.`)
    if (seen.has(run.run_id) || (expected && expected !== run.run_id) || (hash && hash !== run.plan_hash)) {
      throw new Error('La cadena de copias tiene referencias incoherentes.')
    }
    seen.add(run.run_id); hash = run.plan_hash; chain.push(name)
    if (!run.retry_of) return chain
    if (chain.length >= MAX_BACKUP_CHAIN) throw new Error('La cadena de copias supera 50 correcciones.')
    expected = run.retry_of.run_id; name = basename(run.retry_of.artifact)
  }
}
