package engine

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"heimdall/internal/model"
	"heimdall/internal/plan"
	"heimdall/internal/ssh"
)

// dialCounter is a dialer that records how many openings were in flight at
// the same time against each destination. The peak is what MaxStartups
// counts.
type dialCounter struct {
	mu   sync.Mutex
	open map[string]int
	peak map[string]int
}

func newDialCounter() *dialCounter {
	return &dialCounter{open: map[string]int{}, peak: map[string]int{}}
}

func (d *dialCounter) dial(ctx context.Context, cfg ssh.Config) (Session, *ssh.DialError) {
	endpoint := fmt.Sprintf("%s:%d", cfg.Address, cfg.Port)
	d.mu.Lock()
	d.open[endpoint]++
	if d.open[endpoint] > d.peak[endpoint] {
		d.peak[endpoint] = d.open[endpoint]
	}
	d.mu.Unlock()

	// The handshake is not instant: without a wait here every worker would
	// pass through before the next one arrived and no gate would be needed.
	time.Sleep(2 * time.Millisecond)

	d.mu.Lock()
	d.open[endpoint]--
	d.mu.Unlock()
	return echoSession(), nil
}

func (d *dialCounter) peakOf(endpoint string) int {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.peak[endpoint]
}

// classOf builds a plan of n students, all examined on the same machine.
// That is the shape the cap exists for: one shared server and a full class
// knocking on it at once.
func classOf(n int, ip string, port int) *plan.Plan {
	host := plan.Host{IP: ip, Port: port, User: "alu", PasswordRef: "${AULA_PASSWORD}"}
	students := make([]plan.StudentPlan, n)
	for i := range students {
		id := fmt.Sprintf("alu%03d", i)
		checks := twoChecks()
		for j := range checks {
			checks[j].Target = host
		}
		students[i] = plan.StudentPlan{ID: id, Name: id, Checks: checks}
	}
	return testPlan(students...)
}

// TestHostConcurrencyIsNeverExceeded is the criterion of T030 without a
// network: a whole class against one machine never has more connections
// opening at once than the cap, however wide the pool is.
func TestHostConcurrencyIsNeverExceeded(t *testing.T) {
	const students, pool, cap = 100, 32, 4

	d := newDialCounter()
	run := Run(context.Background(), classOf(students, "127.1.2.3", 2201), Options{
		RunID: "R", Secrets: secrets, Dial: d.dial,
		Concurrency: pool, HostConcurrency: cap,
	})

	if peak := d.peakOf("127.1.2.3:2201"); peak > cap {
		t.Errorf("se han abierto %d conexiones a la vez contra la misma máquina; el tope es %d", peak, cap)
	}
	if run.Status != model.RunComplete {
		t.Errorf("la ejecución ha salido %q y debía estar completa", run.Status)
	}
	for _, s := range run.Students {
		for _, c := range s.Checks {
			if c.Status == model.Unevaluated {
				t.Fatalf("%s/%s ha salido sin evaluar por %s", s.StudentID, c.CheckID, c.Cause)
			}
		}
	}
	if run.Plan.HostConcurrency != cap {
		t.Errorf("el artefacto dice %d conexiones por máquina y eran %d", run.Plan.HostConcurrency, cap)
	}
}

// TestHostConcurrencyIsPerHost: the cap bounds each machine, not the run. Two
// machines may be dialled at the same time up to the cap each.
func TestHostConcurrencyIsPerHost(t *testing.T) {
	g := newHostGate(1)
	if !g.acquire(context.Background(), "a:22") {
		t.Fatal("no se ha podido reservar turno en la primera máquina")
	}
	if !g.acquire(context.Background(), "b:22") {
		t.Fatal("una máquina ocupada ha bloqueado a otra distinta")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	if g.acquire(ctx, "a:22") {
		t.Error("se ha dado un segundo turno en una máquina con el tope a 1")
	}

	g.release("a:22")
	if !g.acquire(context.Background(), "a:22") {
		t.Error("el turno no se ha devuelto al soltarlo")
	}
}

// TestPlanDefaultsFeedTheEngine: with nothing on the command line, the caps
// are the PLAN's and the artifact says so.
func TestPlanDefaultsFeedTheEngine(t *testing.T) {
	p := classOf(4, "127.1.2.3", 2201)
	p.Summary.Concurrency = plan.DefaultConcurrency
	p.Summary.HostConcurrency = plan.DefaultHostConcurrency

	d := newDialCounter()
	run := Run(context.Background(), p, Options{RunID: "R", Secrets: secrets, Dial: d.dial})

	if run.Plan.Concurrency != plan.DefaultConcurrency || run.Plan.HostConcurrency != plan.DefaultHostConcurrency {
		t.Errorf("el artefacto dice %d/%d y el PLAN fijaba %d/%d",
			run.Plan.Concurrency, run.Plan.HostConcurrency,
			plan.DefaultConcurrency, plan.DefaultHostConcurrency)
	}
	if peak := d.peakOf("127.1.2.3:2201"); peak > plan.DefaultHostConcurrency {
		t.Errorf("se han abierto %d conexiones a la vez y el tope del PLAN era %d", peak, plan.DefaultHostConcurrency)
	}
}
