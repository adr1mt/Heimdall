package main

import (
	"context"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"heimdall/internal/model"
	"heimdall/internal/plan"
	"heimdall/internal/ssh"
)

const deliverSecret = "HEIMDALL_SECRET_TEST_12345"

// fakeHome records what each machine would have been given.
type fakeHome struct {
	mu      sync.Mutex
	written map[string]string // address -> content
	dialed  []ssh.Config
	refuse  map[string]string // address -> dial error
}

type fakeSession struct {
	home    *fakeHome
	address string
}

func (f *fakeSession) WriteHome(_ context.Context, name string, data []byte, _ time.Duration) error {
	f.home.mu.Lock()
	defer f.home.mu.Unlock()
	f.home.written[f.address+"/"+name] = string(data)
	return nil
}

func (f *fakeSession) Close() error { return nil }

func withFakeHome(t *testing.T, refuse map[string]string) *fakeHome {
	t.Helper()
	home := &fakeHome{written: map[string]string{}, refuse: refuse}
	old := deliverDial
	deliverDial = func(_ context.Context, cfg ssh.Config) (homeWriter, *ssh.DialError) {
		home.mu.Lock()
		defer home.mu.Unlock()
		home.dialed = append(home.dialed, cfg)
		address := cfg.Address + ":" + strconv.Itoa(cfg.Port)
		if detail, ok := home.refuse[address]; ok {
			return nil, &ssh.DialError{Cause: model.CauseConnectFailed, Detail: detail}
		}
		return &fakeSession{home: home, address: address}, nil
	}
	t.Cleanup(func() { deliverDial = old })
	return home
}

// deliverPlan has one machine per student, on the same address and a
// different port, as in the lab.
func deliverPlan(ids ...string) *plan.Plan {
	p := &plan.Plan{ConnectTimeout: time.Second, Summary: model.PlanSummary{Concurrency: 4}}
	for i, id := range ids {
		p.Students = append(p.Students, plan.StudentPlan{ID: id, Name: id, Checks: []plan.ResolvedCheck{
			{ID: "nota", Value: "x"}, // a check without a machine does not choose the host
			{ID: "c1", Host: "host1", Target: plan.Host{IP: "127.1.2.3", Port: 2201 + i, User: "alumno", PasswordRef: "${AULA_PASSWORD}"}},
		}})
	}
	return p
}

func deliverRun(fingerprinted []string, ids ...string) *model.RunResult {
	run := &model.RunResult{RunID: "R1"}
	for _, id := range ids {
		run.Students = append(run.Students, model.StudentResult{StudentID: id, Name: "Nombre " + id, Status: model.StudentOK})
	}
	for _, id := range fingerprinted {
		run.Warnings = append(run.Warnings, model.Warning{
			Scope: "student:" + id + "/host:host1", Code: "HOST_KEY_ACCEPTED",
			Message: "la identidad de 127.1.2.3:22 se ha aceptado y anotado para esta ejecución: SHA256:huella-" + id,
		})
	}
	return run
}

// Every student gets their own page on their own machine, and nobody else's.
func TestDeliverSendsEachStudentOnlyTheirOwnReport(t *testing.T) {
	home := withFakeHome(t, nil)
	ids := []string{"alu1", "alu2", "alu3"}
	reports := map[string]string{"alu1": "pagina de alu1", "alu2": "pagina de alu2", "alu3": "pagina de alu3"}
	out := deliver(context.Background(), deliverRun(ids, ids...), deliverPlan(ids...), reports,
		map[string]string{"AULA_PASSWORD": deliverSecret}, "informe.html")

	want := map[string]string{
		"127.1.2.3:2201/informe.html": "pagina de alu1",
		"127.1.2.3:2202/informe.html": "pagina de alu2",
		"127.1.2.3:2203/informe.html": "pagina de alu3",
	}
	if len(home.written) != len(want) {
		t.Fatalf("escrito = %v", home.written)
	}
	for k, v := range want {
		if home.written[k] != v {
			t.Errorf("%s recibió %q, se esperaba %q", k, home.written[k], v)
		}
	}
	for _, s := range out.Students {
		if !s.Delivered || s.Reason != "" {
			t.Errorf("%s: %+v", s.StudentID, s)
		}
	}
	for _, cfg := range home.dialed {
		if cfg.Password != deliverSecret || cfg.Keys == nil {
			t.Errorf("la conexión tiene que llevar la contraseña de la clase y la identidad fijada: %+v", cfg.Host)
		}
	}
}

// A machine that does not answer, or that is not the corrected one, costs
// its own student only, and the reason is said.
func TestDeliverReportsWhoDidNotGetIt(t *testing.T) {
	home := withFakeHome(t, map[string]string{"127.1.2.3:2202": "no se ha podido conectar con 127.1.2.3:2202 tras 3 intentos"})
	ids := []string{"alu1", "alu2", "alu3"}
	reports := map[string]string{"alu1": "a", "alu2": "b", "alu3": "c"}
	// alu3's machine did not answer in the correction: no identity to check.
	out := deliver(context.Background(), deliverRun([]string{"alu1", "alu2"}, ids...), deliverPlan(ids...), reports,
		map[string]string{"AULA_PASSWORD": deliverSecret}, "informe-red.html")

	got := map[string]studentDelivery{}
	for _, s := range out.Students {
		got[s.StudentID] = s
	}
	if !got["alu1"].Delivered {
		t.Errorf("alu1 tenía que recibirlo: %+v", got["alu1"])
	}
	if got["alu2"].Delivered || !strings.Contains(got["alu2"].Reason, "no se ha podido conectar") {
		t.Errorf("alu2: %+v", got["alu2"])
	}
	if got["alu3"].Delivered || !strings.Contains(got["alu3"].Reason, "no se llegó a conectar") {
		t.Errorf("alu3: %+v", got["alu3"])
	}
	for _, cfg := range home.dialed {
		if cfg.Port == 2203 {
			t.Error("se conectó con una máquina cuya identidad no se anotó en la corrección")
		}
	}
}

// A poisoned report: the password inside it, next to text that would be a
// command if anything interpreted it. The first is not sent anywhere; the
// second reaches the machine byte for byte, as data.
func TestDeliverNeverSendsAPasswordAndNeverInterpretsTheReport(t *testing.T) {
	home := withFakeHome(t, nil)
	poison := `<p>"; rm -rf ~; echo '$(id)' ` + "`whoami`" + `</p>`
	ids := []string{"alu1", "alu2"}
	reports := map[string]string{"alu1": "<p>" + deliverSecret + "</p>", "alu2": poison}
	out := deliver(context.Background(), deliverRun(ids, ids...), deliverPlan(ids...), reports,
		map[string]string{"AULA_PASSWORD": deliverSecret}, "informe-red.html")

	if out.Students[0].Delivered || !strings.Contains(out.Students[0].Reason, "contraseña") {
		t.Errorf("un informe con la contraseña no puede enviarse: %+v", out.Students[0])
	}
	for k, v := range home.written {
		if strings.Contains(v, deliverSecret) {
			t.Errorf("la contraseña llegó a %s", k)
		}
	}
	if home.written["127.1.2.3:2202/informe-red.html"] != poison {
		t.Errorf("el informe tiene que llegar tal cual: %q", home.written["127.1.2.3:2202/informe-red.html"])
	}
	for _, s := range out.Students {
		if strings.Contains(s.Reason, deliverSecret) {
			t.Error("la contraseña aparece en la respuesta")
		}
	}
}

// Only a report file name is accepted: no path, no hidden file, no shell.
func TestDeliverRefusesAnythingButAReportName(t *testing.T) {
	for _, name := range []string{"../informe-x.html", "informe-x.html; rm -rf ~", ".bashrc", "informe-.html", "informe-X.html", "/etc/passwd", "informe-x.sh", "informe-x", "informe.html/subfile", "informe.html; id", "Informe.html", "otro.html"} {
		var stdout, stderr strings.Builder
		if got := run([]string{"deliver", "--artifact=x.json", "--file=" + name}, &stdout, &stderr); got != exitInvalidConfig {
			t.Errorf("%q: exit = %d", name, got)
		}
		if !strings.Contains(stderr.String(), "no es un nombre de informe") {
			t.Errorf("%q: stderr = %q", name, stderr.String())
		}
	}
	for _, name := range []string{"informe.html", "informe-practica-3-dns.html"} {
		var stdout, stderr strings.Builder
		run([]string{"deliver", "--artifact=x.json", "--file=" + name}, &stdout, &stderr)
		if !deliverName.MatchString(name) || strings.Contains(stderr.String(), "no es un nombre de informe") {
			t.Errorf("un nombre válido se rechazó: %s: %s", name, stderr.String())
		}
	}
}

// A result whose exam or classroom changed since the correction is not sent:
// the classroom may now point at other machines.
func TestDeliverRefusesAPlanThatChanged(t *testing.T) {
	examPath := filepath.Join(protoProject, "examen.yaml")
	inventoryPath := filepath.Join(protoProject, "aula.yaml")
	p, err := plan.Load(protoProject)
	if err != nil {
		t.Fatal(err)
	}
	same := &model.RunResult{PlanHash: p.Hash, Exam: model.SourceRef{Path: examPath}, Inventory: model.SourceRef{Path: inventoryPath}}
	if _, err := planOf(same); err != nil {
		t.Fatalf("el mismo PLAN tiene que aceptarse: %v", err)
	}
	changed := *same
	changed.PlanHash = "otro"
	if _, err := planOf(&changed); err == nil || !strings.Contains(err.Error(), "han cambiado") {
		t.Errorf("un PLAN distinto tiene que rechazarse: %v", err)
	}
	elsewhere := *same
	elsewhere.Inventory.Path = "/tmp/aula.yaml"
	if _, err := planOf(&elsewhere); err == nil {
		t.Error("un aula de otra carpeta tiene que rechazarse")
	}
}

// Reports only for students of this correction.
func TestDeliverReadsOnlyReportsOfThisCorrection(t *testing.T) {
	run := deliverRun(nil, "alu1")
	run.Students = append(run.Students, model.StudentResult{StudentID: "fuera", Status: model.StudentExcluded})
	cases := map[string]string{
		`{"schema":1,"reports":{"alu1":"x"}}`:  "",
		`{"schema":1,"reports":{"otro":"x"}}`:  "no es un alumno",
		`{"schema":1,"reports":{"fuera":"x"}}`: "no es un alumno",
		`{"schema":2,"reports":{"alu1":"x"}}`:  "no son un documento",
		`{"schema":1,"reports":{}}`:            "no son un documento",
		`no es json`:                           "no son un documento",
	}
	for doc, want := range cases {
		_, err := readReports(strings.NewReader(doc), run)
		if want == "" && err != nil || want != "" && (err == nil || !strings.Contains(err.Error(), want)) {
			t.Errorf("%s: err = %v, se esperaba %q", doc, err, want)
		}
	}
}

func TestIdentitiesComeFromTheCorrection(t *testing.T) {
	got := identitiesOf(deliverRun([]string{"alu1"}, "alu1"))
	if got["alu1/host1"] != "SHA256:huella-alu1" || len(got) != 1 {
		t.Errorf("identidades = %v", got)
	}
}

// Selecting one report must not open connections to the rest of the class.
func TestDeliverOnlyRequestedStudent(t *testing.T) {
	home := withFakeHome(t, nil)
	ids := []string{"alu1", "alu2", "alu3"}
	out := deliver(context.Background(), deliverRun(ids, ids...), deliverPlan(ids...),
		map[string]string{"alu2": "solo alu2"}, map[string]string{"AULA_PASSWORD": deliverSecret}, "informe.html")
	if len(out.Students) != 1 || out.Students[0].StudentID != "alu2" || !out.Students[0].Delivered {
		t.Fatalf("entrega individual: %+v", out)
	}
	if len(home.dialed) != 1 || home.dialed[0].Port != 2202 || len(home.written) != 1 {
		t.Fatalf("se contactó con otro alumno: %d conexiones, %d escrituras", len(home.dialed), len(home.written))
	}
}
