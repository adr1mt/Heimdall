import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { readGroup, isColumnName, type ClassGroup } from '../shared/classes'

/**
 * Where the teacher's classes live (ADR-0021): one JSON file in the
 * application's own data directory, written atomically.
 *
 * Unlike the settings, an unreadable file here is NOT replaced by an empty
 * list. Re-choosing the engine's path costs ten seconds; writing down
 * twenty-six students again does not. A broken file is reported and left
 * exactly as it is, and saving stays blocked until it is sorted out
 * (ADR-0021 §5, principio 2).
 */
export function classesFile(dir: string): string {
  return join(dir, 'classes.json')
}

export function readClasses(dir: string): ClassGroup[] {
  const path = classesFile(dir)
  if (!existsSync(path)) return []
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf-8'))
  } catch (error) {
    throw new Error(
      `No se pudo leer el fichero de clases (${path}). No se ha tocado, y no se puede guardar ninguna clase hasta arreglarlo: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
  const list = Array.isArray((raw as { classes?: unknown })?.classes)
    ? (raw as { classes: unknown[] }).classes
    : null
  if (!list) {
    throw new Error(
      `El fichero de clases (${path}) no tiene la forma esperada. No se ha tocado, y no se puede guardar ninguna clase hasta arreglarlo.`
    )
  }
  try { validateClasses(list) } catch(error) {
    throw new Error(`El fichero de clases (${path}) contiene datos inválidos: ${error instanceof Error ? error.message : String(error)}. No se ha tocado; guardar está bloqueado hasta arreglarlo.`)
  }
  return list.map(value=>readGroup(value)!)
}

/**
 * Saves the whole list. It reads first: writing over a file that cannot be
 * read would be losing the teacher's work without saying so.
 *
 * Only the fields of the model are serialized, so nothing that was never part
 * of a class —a password above all— can travel in and back out again.
 */
export function writeClasses(dir: string, classes: ClassGroup[]): void {
  readClasses(dir)
  validateClasses(classes)
  const path = classesFile(dir)
  const payload = {
    classes: classes.map((group) => ({
      id: group.id,
      name: group.name,
      columns: group.columns,
      students: group.students.map((student) => ({
        id: student.id,
        name: student.name,
        contact: student.contact,
        host: student.host,
        port: student.port,
        user: student.user,
        fields: student.fields
      }))
    }))
  }
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
  renameSync(tmp, path)
}

/** File reads cannot use the tolerant importer: every saved row must survive. */
function validateClasses(list: unknown[]): void {
 const object=(v:unknown,at:string):Record<string,unknown>=> {if(!v || typeof v!=='object' || Array.isArray(v)) throw new Error(`${at}: se esperaba un objeto`);return v as Record<string,unknown>}
 const string=(raw:Record<string,unknown>,key:string,at:string,required=false):void=> {const v=raw[key];if((v!==undefined && typeof v!=='string') || (required && (typeof v!=='string' || !v.trim()))) throw new Error(`${at}.${key}: texto ${required?'obligatorio':'inválido'}`)}
 const groupIds=new Set<string>()
 for(const [i,value] of list.entries()) {
  const at=`classes[${i+1}]`,g=object(value,at)
  string(g,'id',at,true);string(g,'name',at,true)
  if(groupIds.has(g.id as string)) throw new Error(`${at}.id: identificador repetido`)
  groupIds.add(g.id as string)
  if(g.columns!==undefined && (!Array.isArray(g.columns) || g.columns.some(c=>typeof c!=='string' || !isColumnName(c)) || new Set(g.columns).size!==g.columns.length)) throw new Error(`${at}.columns: columnas inválidas`)
  if(!Array.isArray(g.students)) throw new Error(`${at}.students: se esperaba una lista`)
  const ids=new Set<string>()
  for(const [j,value] of g.students.entries()) {
   const where=`${at}.students[${j+1}]`,student=object(value,where)
   for(const key of ['id','name','contact','host','port','user']) string(student,key,where,key==='id')
   if(ids.has((student.id as string).trim())) throw new Error(`${where}.id: identificador repetido`)
   ids.add((student.id as string).trim())
   if(student.fields!==undefined) for(const [key,v] of Object.entries(object(student.fields,`${where}.fields`))) if(!isColumnName(key) || typeof v!=='string') throw new Error(`${where}.fields.${key}: campo inválido`)
  }
 }
}
