import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { open, readdir, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { parseArtifact } from '../shared/artifact'
import { gradesOnly, type BackupEntry, type RestoreReport } from '../shared/backup'
import { MAX_ARTIFACT } from './artifact'
import { RUN_FILE, varDirOf } from './history'

/**
 * How many copies one exam keeps. The same number the history shows: a copy
 * of a correction nobody can list is a copy nobody restores, and a directory
 * that grows without end is not a backup, it is a leak.
 */
export const MAX_BACKUPS = 50

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
 // Only a bounded header is read for retention. At most 50 full artifacts are
 // parsed/copied, regardless of the size of the teacher's original history.
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
 const candidates=(await dated(sourceDir)).slice(0,MAX_BACKUPS)
 for(const {name} of candidates) {
  const target=join(slot,name),source=join(sourceDir,name)
  try {
   try {await stat(target);continue} catch(error) {if((error as NodeJS.ErrnoException).code!=='ENOENT') throw error}
   if((await stat(source)).size>MAX_ARTIFACT) throw new Error('resultado demasiado grande para copiar')
   const run=parseArtifact(await readFile(source,'utf8'))
   await mkdir(slot,{recursive:true})
   const tmp=`${target}.tmp`
   try {await writeFile(tmp,`${JSON.stringify(gradesOnly(run))}\n`,'utf8');await rename(tmp,target)} finally {await rm(tmp,{force:true}).catch(()=>undefined)}
   report.saved++
  } catch(error) {failure(source,error)}
 }
 for(const {name} of (await dated(slot)).slice(MAX_BACKUPS)) {
  try {await rm(join(slot,name))} catch(error) {failure(join(slot,name),error)}
 }
 return report
}

/** The copies of one exam, newest correction first. */
export function listBackups(dataDir: string, examPath: string): BackupEntry[] {
  const slot = slotFor(dataDir, examPath)
  const varDir = varDirOf(examPath)
  const entries: BackupEntry[] = []
  for (const name of runFilesIn(slot)) {
    const path = join(slot, name)
    try {
      const run = parseArtifact(readFileSync(path, 'utf-8'))
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
  const names = runFilesIn(slot)
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
