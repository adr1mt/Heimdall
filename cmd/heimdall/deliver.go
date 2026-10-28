package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"heimdall/internal/engine"
	"heimdall/internal/model"
	"heimdall/internal/plan"
	"heimdall/internal/ssh"
)

// deliveryVersion is the version of the line `heimdall deliver` prints.
const deliveryVersion = 1

// deliverWriteTimeout bounds the write itself, once the machine answered.
const deliverWriteTimeout = 30 * time.Second

// maxReportsBytes caps what is read from stdin after the secrets line, and
// maxReportBytes one student's page. A report of T185 is a few kilobytes.
const (
	maxReportsBytes = 32 << 20
	maxReportBytes  = 1 << 20
)

// reportsReadTimeout is how long the reports may take to arrive on stdin.
const reportsReadTimeout = 10 * time.Second

// deliverName is the only kind of file Heimdall writes on a student's machine
// (ADR-0031): no path, no hidden file, nothing but a report.
var deliverName = regexp.MustCompile(`^informe(-[a-z0-9]+(-[a-z0-9]+)*)?\.html$`)

// homeWriter is what delivering needs from a session. Tests replace the dialer.
type homeWriter interface {
	WriteHome(ctx context.Context, name string, data []byte, timeout time.Duration) error
	Close() error
}

var deliverDial = func(ctx context.Context, cfg ssh.Config) (homeWriter, *ssh.DialError) {
	s, err := ssh.Dial(ctx, cfg)
	if err != nil {
		return nil, err
	}
	return s, nil
}

// delivery is what `heimdall deliver` prints: one line of JSON.
type delivery struct {
	Kind            string            `json:"kind"`
	DeliveryVersion int               `json:"delivery_version"`
	RunID           string            `json:"run_id"`
	File            string            `json:"file"`
	Students        []studentDelivery `json:"students"`
}

type studentDelivery struct {
	StudentID string `json:"student_id"`
	Name      string `json:"name"`
	Delivered bool   `json:"delivered"`
	Reason    string `json:"reason,omitempty"`
}

// deliverCmd leaves each student's report in the home directory of their own
// machine, the one that was corrected, and says to whom it arrived (ADR-0031).
// It changes no grade and writes nothing on this computer.
func deliverCmd(args []string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("deliver", flag.ContinueOnError)
	fs.SetOutput(stderr)
	secretsMode := fs.String("secrets", "env", "canal de los secretos: stdin o env")
	artifactPath := fs.String("artifact", "", "resultado de la corrección cuyos informes se envían")
	sourceDir := fs.String("source-dir", "", "definiciones conservadas de una sesión finalizada")
	name := fs.String("file", "", "nombre del fichero en la carpeta personal: informe.html")
	if err := fs.Parse(args); err != nil {
		return exitInvalidConfig
	}
	if fs.NArg() != 0 || *artifactPath == "" || *name == "" {
		fmt.Fprintln(stderr, "uso: heimdall deliver [--secrets=stdin|env] --artifact=<resultado.json> --file=informe.html")
		return exitInvalidConfig
	}
	fail := func(format string, a ...any) int {
		fmt.Fprintf(stderr, "heimdall deliver: "+format+"\n", a...)
		return exitInvalidConfig
	}
	if len(*name) > 120 || !deliverName.MatchString(*name) {
		return fail("%q no es un nombre de informe: se espera informe.html o informe-<letras, cifras y guiones>.html", *name)
	}

	if *sourceDir != "" && !strings.HasPrefix(*name, "informe-final-") {
		return fail("las definiciones conservadas solo se usan para informes finales")
	}

	run, err := readArtifact(*artifactPath)
	if err != nil {
		return fail("%s", err)
	}
	p, err := planOfSources(run, *sourceDir)
	if err != nil {
		return fail("%s", err)
	}

	secrets, err := readSecrets(*secretsMode, p)
	if err != nil {
		return fail("%s", err)
	}
	defer func() {
		for k := range secrets {
			delete(secrets, k)
		}
	}()
	if err := engine.CheckSecrets(p, secrets); err != nil {
		return fail("faltan credenciales\n\n%s", err)
	}
	reports, err := readReports(stdin, run)
	if err != nil {
		return fail("%s", err)
	}

	out := deliver(context.Background(), run, p, reports, secrets, *name)
	line, err := json.Marshal(out)
	if err != nil {
		fmt.Fprintf(stderr, "heimdall deliver: %s\n", err)
		return exitFailure
	}
	fmt.Fprintf(stdout, "%s\n", line)
	for _, s := range out.Students {
		if !s.Delivered {
			return exitPartial
		}
	}
	return exitOK
}

// planOf resolves the PLAN again from the exam and classroom the result names,
// and refuses it unless it is the PLAN that was corrected. A report must land
// on the machine that was examined, not on the one the classroom says today.
func planOf(run *model.RunResult) (*plan.Plan, error) {
	return planOfSources(run, "")
}

func planOfSources(run *model.RunResult, sourceDir string) (*plan.Plan, error) {
	dir := filepath.Dir(run.Exam.Path)
	if filepath.Base(run.Exam.Path) != plan.ExamFile || filepath.Dir(run.Inventory.Path) != dir {
		return nil, fmt.Errorf("el resultado no apunta a un examen y un aula de la misma carpeta")
	}
	if sourceDir != "" {
		dir = sourceDir
	}
	p, err := plan.LoadNamed(dir, filepath.Base(run.Inventory.Path))
	if err != nil {
		return nil, fmt.Errorf("no se puede leer el examen o el aula de esta corrección\n\n%s", err)
	}
	if p.Hash != run.PlanHash {
		return nil, fmt.Errorf("el examen o la clase han cambiado desde esta corrección: los informes solo se envían a las máquinas que se corrigieron; vuelve a corregir")
	}
	return p, nil
}

// readReports reads {"schema":1,"reports":{"<student_id>":"<html>"}} from the
// rest of stdin. A report of somebody who is not in this correction is a
// mistake of whoever asked, not something to send anywhere.
func readReports(r io.Reader, run *model.RunResult) (map[string]string, error) {
	type result struct {
		data []byte
		err  error
	}
	done := make(chan result, 1)
	go func() {
		data, err := io.ReadAll(io.LimitReader(r, maxReportsBytes+1))
		done <- result{data, err}
	}()
	var data []byte
	select {
	case res := <-done:
		if res.err != nil {
			return nil, fmt.Errorf("no se pudieron leer los informes de stdin")
		}
		data = res.data
	case <-time.After(reportsReadTimeout):
		return nil, fmt.Errorf("no llegaron los informes por stdin en %s", reportsReadTimeout)
	}
	if len(data) > maxReportsBytes {
		return nil, fmt.Errorf("los informes pasan de %d bytes", maxReportsBytes)
	}
	var doc struct {
		Schema  int               `json:"schema"`
		Reports map[string]string `json:"reports"`
	}
	if err := json.Unmarshal(data, &doc); err != nil || doc.Schema != 1 || len(doc.Reports) == 0 {
		return nil, fmt.Errorf("los informes de stdin no son un documento válido")
	}
	students := map[string]bool{}
	for _, s := range run.Students {
		if s.Status != model.StudentExcluded {
			students[s.StudentID] = true
		}
	}
	for id, html := range doc.Reports {
		if !students[id] {
			return nil, fmt.Errorf("hay un informe para %q, que no es un alumno de esta corrección", id)
		}
		if len(html) > maxReportBytes {
			return nil, fmt.Errorf("el informe de %s pasa de %d bytes", id, maxReportBytes)
		}
	}
	return doc.Reports, nil
}

// deliver sends every student their own report, in parallel. One machine that
// does not answer only costs its own student, and every attempt is bounded.
func deliver(ctx context.Context, run *model.RunResult, p *plan.Plan, reports, secrets map[string]string, name string) delivery {
	plans := map[string]plan.StudentPlan{}
	for _, sp := range p.Students {
		plans[sp.ID] = sp
	}
	identities := identitiesOf(run)

	out := delivery{Kind: "delivery", DeliveryVersion: deliveryVersion, RunID: run.RunID, File: name}
	for _, s := range run.Students {
		if _, requested := reports[s.StudentID]; requested && s.Status != model.StudentExcluded {
			out.Students = append(out.Students, studentDelivery{StudentID: s.StudentID, Name: s.Name})
		}
	}

	limit := p.Summary.Concurrency
	if limit < 1 {
		limit = 1
	}
	slots := make(chan struct{}, limit)
	var wg sync.WaitGroup
	for i := range out.Students {
		wg.Add(1)
		go func(d *studentDelivery) {
			defer wg.Done()
			slots <- struct{}{}
			defer func() { <-slots }()
			if err := deliverOne(ctx, p, plans[d.StudentID], reports[d.StudentID], identities, secrets, name); err != nil {
				d.Reason = err.Error()
				return
			}
			d.Delivered = true
		}(&out.Students[i])
	}
	wg.Wait()
	return out
}

func deliverOne(ctx context.Context, p *plan.Plan, sp plan.StudentPlan, html string, identities, secrets map[string]string, name string) error {
	var host string
	var target plan.Host
	for _, c := range sp.Checks {
		if c.Host != "" {
			host, target = c.Host, c.Target
			break
		}
	}
	if host == "" {
		return fmt.Errorf("el examen no usa ninguna máquina de este alumno")
	}
	if html == "" {
		return fmt.Errorf("no llegó su informe")
	}
	for _, secret := range secrets {
		if secret != "" && strings.Contains(html, secret) {
			return fmt.Errorf("el informe contenía una contraseña y no se ha enviado")
		}
	}
	fingerprint := identities[sp.ID+"/"+host]
	if fingerprint == "" {
		return fmt.Errorf("en esta corrección no se llegó a conectar con su máquina, así que no se puede asegurar que sea la misma")
	}
	password := ""
	if m := refPattern.FindStringSubmatch(target.PasswordRef); m != nil {
		password = secrets[m[1]]
	}

	address := net.JoinHostPort(target.IP, strconv.Itoa(target.Port))
	keys := ssh.NewHostKeys()
	keys.Pin(address, fingerprint)
	budget := 3*p.ConnectTimeout + 10*time.Second + deliverWriteTimeout
	studentCtx, cancel := context.WithTimeout(ctx, budget)
	defer cancel()

	session, derr := deliverDial(studentCtx, ssh.Config{
		Host:           host,
		Address:        target.IP,
		Port:           target.Port,
		User:           target.User,
		Password:       password,
		ConnectTimeout: p.ConnectTimeout,
		Keys:           keys,
	})
	if derr != nil {
		return fmt.Errorf("%s", derr.Detail)
	}
	defer session.Close()
	return session.WriteHome(studentCtx, name, []byte(html), deliverWriteTimeout)
}

// identitiesOf reads, from the warnings of the correction, the fingerprint
// each student's machine presented: "<student_id>/<host>" -> "SHA256:…".
func identitiesOf(run *model.RunResult) map[string]string {
	out := map[string]string{}
	for _, w := range run.Warnings {
		if w.Code != "HOST_KEY_ACCEPTED" || !strings.HasPrefix(w.Scope, "student:") {
			continue
		}
		student, host, ok := strings.Cut(strings.TrimPrefix(w.Scope, "student:"), "/host:")
		at := strings.LastIndex(w.Message, "SHA256:")
		if !ok || at < 0 {
			continue
		}
		out[student+"/"+host] = strings.TrimSpace(w.Message[at:])
	}
	return out
}
