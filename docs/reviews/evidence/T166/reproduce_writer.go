//go:build ignore

// Synthetic audit harness. Only inventory checks are accepted; no SSH.
package main

import (
 "context"
 "encoding/json"
 "fmt"
 "os"
 "runtime"
 "time"

 "heimdall/internal/engine"
 "heimdall/internal/model"
 "heimdall/internal/plan"
 "heimdall/internal/report"
)

func main() {
 if len(os.Args)!=3 { panic("usage: reproduce_writer <synthetic-project> <full|final>") }
 p,err:=plan.Load(os.Args[1]); if err!=nil { panic(err) }
 var loaded runtime.MemStats;runtime.ReadMemStats(&loaded)
 fmt.Printf("plan_heap_alloc=%d plan_total_alloc=%d plan_sys=%d\n",loaded.HeapAlloc,loaded.TotalAlloc,loaded.Sys)
 for _,s:=range p.Students { for _,c:=range s.Checks { if len(c.Cmd)>0 { panic("only synthetic inventory checks allowed") } } }
 dir,err:=os.MkdirTemp("","heimdall-audit-writer-");if err!=nil {panic(err)}
 w,err:=report.New(dir,"SYNTHETIC",nil);if err!=nil {panic(err)}
 partials:=0;var written int64
 opts:=engine.Options{RunID:"SYNTHETIC",EngineVersion:"audit"}
 if os.Args[2]=="full" {opts.OnStudentDone=func(run *model.RunResult)error {partials++;err:=w.WritePartial(run);if err==nil {info,_:=os.Stat(w.PartialPath());written+=info.Size()};return err}}
 start:=time.Now()
 run:=engine.Run(context.Background(),p,opts)
 path,err:=w.WriteFinal(run);if err!=nil {panic(err)}
 info,_:=os.Stat(path);written+=info.Size()
 for _,s:=range run.Students {if s.Score.Final==nil || *s.Score.Final!=100 {panic("grade mismatch")}}
 data,_:=json.Marshal(map[string]any{"mode":os.Args[2],"seconds":time.Since(start).Seconds(),"partials":partials,"bytes_written":written,"all_grades":100,"artifact":path})
 fmt.Println(string(data))
}
